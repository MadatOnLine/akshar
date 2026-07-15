# Stop Akshar demo services (ports 8001, 8002, 8003) and optional CouchDB container.
Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

foreach ($port in 8001, 8002, 8003) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force
            Write-Host "Stopped process on port $port (PID $($_.OwningProcess))"
        }
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker stop akshar-couch 2>$null | Out-Null
    Write-Host "Stopped Docker container akshar-couch (if it was running)."
}

Write-Host "Demo services stopped." -ForegroundColor Green
