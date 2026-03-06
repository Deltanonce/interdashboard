$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8888/')
$listener.Start()
Write-Host 'SERVER_READY on http://localhost:8888/'
Write-Host 'ADS-B Proxy: http://localhost:8888/api/adsb-mil'
Write-Host 'AIS Proxy:   http://localhost:8888/api/ais-poll'
Write-Host '[AIS] PowerShell proxy runs in HTTP-only mode (no server-side WebSocket relay).'

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

    # --- PROXY: /api/ais-poll (HTTP-only mode) ---
    if ($url -eq '/api/ais-poll') {
        try {
            $jsonResult = @{
                connected = $false
                messages  = @()
                count     = 0
                lastError = 'PowerShell proxy does not provide AIS WebSocket relay. Use browser direct AIS or node server.js + ws dependency.'
                timestamp = (Get-Date -Format 'o')
                mode      = 'http-only'
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
    $relativePath = $url.TrimStart('/').Replace('/', '\\')
    $file = Join-Path $PSScriptRoot $relativePath

    try {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file)
        $ct = 'text/plain'
        if ($ext -eq '.html') { $ct = 'text/html; charset=utf-8' }
        elseif ($ext -eq '.css') { $ct = 'text/css' }
        elseif ($ext -eq '.js') { $ct = 'application/javascript' }
        elseif ($ext -eq '.json') { $ct = 'application/json' }
        elseif ($ext -eq '.geojson') { $ct = 'application/json' }
        elseif ($ext -eq '.png') { $ct = 'image/png' }
        elseif ($ext -eq '.jpg') { $ct = 'image/jpeg' }
        elseif ($ext -eq '.svg') { $ct = 'image/svg+xml' }

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
