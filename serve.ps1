$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:9999/')
$listener.Start()
Write-Host 'SERVER_READY on http://localhost:9999/'
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $raw = $ctx.Request.Url.LocalPath
    $url = $raw -replace '\?.*', ''

    # --- PROXY: /api/adsb-mil → api.adsb.lol/v2/mil ---
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
