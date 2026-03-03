$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8888/')
$listener.Start()
Write-Host 'SERVER_READY on http://localhost:8888/'
Write-Host 'ADS-B Proxy: http://localhost:8888/api/adsb-mil'
Write-Host 'AIS Proxy:   http://localhost:8888/api/ais-poll'

# ── AIS CACHE: Background job collects AIS data via WebSocket ──
$aisCache = [System.Collections.ArrayList]::Synchronized([System.Collections.ArrayList]::new())
$aisEverConnected = $false

function Start-AisCollector {
    param([string]$ApiKey)
    if (-not $ApiKey -or $ApiKey.Length -lt 10) {
        Write-Host '[AIS] No API key, skipping AIS proxy.'
        return
    }

    $script:aisJob = Start-Job -ScriptBlock {
        param($key)
        Add-Type -AssemblyName System.Net.Http
        $messages = [System.Collections.ArrayList]::new()
        $msgCount = 0

        while ($true) {
            try {
                Write-Output "ATTEMPT: Connecting to aisstream.io..."
                $ws = New-Object System.Net.WebSockets.ClientWebSocket
                $ct = [System.Threading.CancellationToken]::None
                $ws.ConnectAsync([Uri]'wss://stream.aisstream.io/v0/stream', $ct).Wait()

                # Send subscription with expanded bounding boxes
                $sub = @{
                    Apikey             = $key
                    BoundingBoxes      = @(
                        @(@(12, 41), @(30, 44)),    # Red Sea
                        @(@(23, 48), @(30, 57)),    # Persian Gulf / Strait of Hormuz
                        @(@(11, 43), @(16, 51)),    # Gulf of Aden
                        @(@(30, 31), @(32, 35)),    # Suez Canal
                        @(@(-2, 100), @(8, 110)),   # Strait of Malacca
                        @(@(-5, 105), @(10, 120)),  # Natuna / South China Sea
                        @(@(20, 115), @(28, 125))   # Taiwan Strait
                    )
                    FilterMessageTypes = @('PositionReport', 'ShipStaticData')
                } | ConvertTo-Json -Compress -Depth 5
                Write-Output "SUBSCRIPTION: $($sub.Substring(0, [Math]::Min(200, $sub.Length)))"
                $subBytes = [System.Text.Encoding]::UTF8.GetBytes($sub)
                $ws.SendAsync([ArraySegment[byte]]::new($subBytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
                Write-Output "CONNECTED"

                $buf = New-Object byte[] 65536
                while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
                    $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), $ct).Result
                    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Text) {
                        $msg = [System.Text.Encoding]::UTF8.GetString($buf, 0, $result.Count)
                        $msgCount++
                        if ($msgCount -le 3 -or $msgCount % 100 -eq 0) {
                            Write-Output "DEBUG: Message #$msgCount received (${result.Count} bytes)"
                        }
                        Write-Output "MSG:$msg"
                    }
                }
                Write-Output "DISCONNECTED: WebSocket state changed to $($ws.State)"
            }
            catch {
                Write-Output "ERROR:$($_.Exception.Message)"
            }
            Start-Sleep -Seconds 5
        }
    } -ArgumentList $ApiKey

    Write-Host "[AIS] Background collector started (Job ID: $($script:aisJob.Id))"
}

# Read AIS API key from config.js
$configPath = Join-Path $PSScriptRoot 'config.js'
$aisKey = ''
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    if ($configContent -match "AISSTREAM_API_KEY\s*=\s*['""]([^'""]+)['""]") {
        $aisKey = $Matches[1]
        Write-Host "[AIS] API key loaded from config.js"
    }
}

# Start AIS background collector
Start-AisCollector -ApiKey $aisKey

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $raw = $ctx.Request.Url.LocalPath
    $url = $raw -replace '\?.*', ''

    # --- PROXY: /api/adsb-mil ---
    if ($url -eq '/api/adsb-mil') {
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add('User-Agent', 'IntelDashboard/4.0')
            $data = $wc.DownloadData('https://api.adsb.lol/v2/mil')
            $ctx.Response.ContentType = 'application/json'
            $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
            $ctx.Response.ContentLength64 = $data.Length
            $ctx.Response.OutputStream.Write($data, 0, $data.Length)
        }
        catch {
            $ctx.Response.StatusCode = 502
            $err = [System.Text.Encoding]::UTF8.GetBytes("Proxy error: $_")
            $ctx.Response.ContentLength64 = $err.Length
            $ctx.Response.OutputStream.Write($err, 0, $err.Length)
        }
        $ctx.Response.Close()
        continue
    }

    # --- PROXY: /api/ais-poll ---
    if ($url -eq '/api/ais-poll') {
        try {
            $aisMessages = @()
            $isConnected = $false
            if ($script:aisJob) {
                # Collect output from background job
                $output = @(Receive-Job -Job $script:aisJob -ErrorAction SilentlyContinue)
                foreach ($line in $output) {
                    $lineStr = [string]$line
                    if ($lineStr.StartsWith('MSG:')) {
                        $aisMessages += $lineStr.Substring(4)
                    }
                    elseif ($lineStr -eq 'CONNECTED') {
                        $isConnected = $true
                        $script:aisEverConnected = $true
                        Write-Host "[AIS] Server-side WebSocket CONNECTED!"
                    }
                    elseif ($lineStr.StartsWith('ERROR:')) {
                        Write-Host "[AIS] Server-side error: $lineStr"
                    }
                    elseif ($lineStr.StartsWith('DEBUG:')) {
                        Write-Host "[AIS] $lineStr"
                    }
                    elseif ($lineStr.StartsWith('ATTEMPT:')) {
                        Write-Host "[AIS] $lineStr"
                    }
                    elseif ($lineStr.StartsWith('SUBSCRIPTION:')) {
                        Write-Host "[AIS] $lineStr"
                    }
                }
                # Check job state
                if ($script:aisJob.State -eq 'Failed') {
                    Write-Host "[AIS] Background job FAILED! Restarting..."
                    Remove-Job -Job $script:aisJob -Force -ErrorAction SilentlyContinue
                    Start-AisCollector -ApiKey $aisKey
                }
            }
            $jsonResult = @{
                connected = $isConnected -or $script:aisEverConnected -or ($aisMessages.Count -gt 0)
                messages  = $aisMessages
                count     = $aisMessages.Count
                timestamp = (Get-Date -Format 'o')
                jobState  = if ($script:aisJob) { $script:aisJob.State.ToString() } else { 'none' }
            } | ConvertTo-Json -Compress -Depth 3
            $respBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResult)
            $ctx.Response.ContentType = 'application/json'
            $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
            $ctx.Response.ContentLength64 = $respBytes.Length
            $ctx.Response.OutputStream.Write($respBytes, 0, $respBytes.Length)
        }
        catch {
            $ctx.Response.StatusCode = 502
            $err = [System.Text.Encoding]::UTF8.GetBytes("AIS error: $_")
            $ctx.Response.ContentLength64 = $err.Length
            $ctx.Response.OutputStream.Write($err, 0, $err.Length)
        }
        $ctx.Response.Close()
        continue
    }

    # --- STATIC FILES ---
    if ($url -eq '/') { $url = '/index.html' }
    $file = Join-Path 'C:\Users\User\.gemini\antigravity\scratch\intel-dashboard' ($url.TrimStart('/').Replace('/', '\'))
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file)
        $ct = 'text/plain'
        if ($ext -eq '.html') { $ct = 'text/html; charset=utf-8' }
        elseif ($ext -eq '.css') { $ct = 'text/css' }
        elseif ($ext -eq '.js') { $ct = 'application/javascript' }
        elseif ($ext -eq '.json') { $ct = 'application/json' }
        elseif ($ext -eq '.geojson') { $ct = 'application/json' }
        $ctx.Response.ContentType = $ct
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    catch {
        $ctx.Response.StatusCode = 404
        $err = [System.Text.Encoding]::UTF8.GetBytes("Not found: $file")
        $ctx.Response.ContentLength64 = $err.Length
        $ctx.Response.OutputStream.Write($err, 0, $err.Length)
    }
    $ctx.Response.Close()
}
