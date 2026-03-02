$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:9999/')
$listener.Start()
Write-Host 'SERVER_READY on http://localhost:9999/'
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $raw = $ctx.Request.Url.LocalPath
    $url = $raw -replace '\?.*',''
    if ($url -eq '/') { $url = '/index.html' }
    $file = Join-Path 'C:\Users\User\.gemini\antigravity\scratch\intel-dashboard' ($url.TrimStart('/').Replace('/','\'))
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file)
        $ct = 'text/plain'
        if ($ext -eq '.html') { $ct = 'text/html; charset=utf-8' }
        elseif ($ext -eq '.css') { $ct = 'text/css' }
        elseif ($ext -eq '.js') { $ct = 'application/javascript' }
        $ctx.Response.ContentType = $ct
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $ctx.Response.StatusCode = 404
        $err = [System.Text.Encoding]::UTF8.GetBytes("Not found: $file")
        $ctx.Response.ContentLength64 = $err.Length
        $ctx.Response.OutputStream.Write($err, 0, $err.Length)
    }
    $ctx.Response.Close()
}
