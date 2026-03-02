$files = @(
    'C:\Users\User\.gemini\antigravity\scratch\intel-dashboard\app.js',
    'C:\Users\User\.gemini\antigravity\scratch\intel-dashboard\app-logic.js',
    'C:\Users\User\.gemini\antigravity\scratch\intel-dashboard\index.html'
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = [System.IO.File]::ReadAllText($f)
        [System.IO.File]::WriteAllText($f, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed encoding for $f"
    }
}
