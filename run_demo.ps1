Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting AgentShield Backend & Frontend for Demo Day" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

# Launch Backend in its own window
Write-Host "[1/2] Launching Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$backendDir`" && python -m uvicorn main:app --port 8000"

# Launch Frontend in its own window
Write-Host "[2/2] Launching Frontend on http://localhost:3000 ..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$frontendDir`" && npm.cmd run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Services launched in dedicated windows!" -ForegroundColor Green
Write-Host "  - Backend:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "  - Frontend: http://localhost:3000/dashboard/chat" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
