$ErrorActionPreference = "Stop"
mkdir -Force "assets\boundaries\regions" | Out-Null
$isos = "IDN","MYS","SGP","THA","VNM","PHL","BRN","KHM","MMR","LAO","TLS","IRN","IRQ","ISR","SAU","SYR","LBN","YEM","OMN","ARE","QAT","BHR","KWT","JOR","TUR","EGY","IND","PAK","AFG","BGD","LKA","NPL","BTN","MDV"

foreach ($iso in $isos) {
    Write-Host "Fetching $iso..." -NoNewline
    $file = "assets\boundaries\regions\$iso.geojson"
    if (Test-Path $file) {
        Write-Host " Already Exists"
        continue
    }
    
    $url = "https://www.geoboundaries.org/api/current/gbOpen/$iso/ADM0/"
    try {
        $res = Invoke-RestMethod -Uri $url
        $geojsonUrl = $null
        if ($res -is [array] -and $res.Count -gt 0) {
            $geojsonUrl = $res[0].simplifiedGeometryGeoJSON
        } elseif ($res -isnot [array]) {
            $geojsonUrl = $res.simplifiedGeometryGeoJSON
        }
        
        if ($geojsonUrl) {
            Invoke-WebRequest -Uri $geojsonUrl -OutFile $file
            Write-Host " OK"
        } else {
            Write-Host " No URL"
        }
    } catch {
        Write-Host " Error: $_"
    }
}
Write-Host "All boundaries saved."
