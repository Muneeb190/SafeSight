$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Starting SafeSight AI Development System" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Launch FastAPI backend in a separate terminal window
Write-Host "[1/2] Starting Backend API on http://localhost:8080..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"
$pythonPath = Join-Path $backendDir ".venv\Scripts\python.exe"

Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$backendDir'; & '$pythonPath' -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"

# 2. Start Next.js frontend in current terminal
Write-Host "[2/2] Starting Frontend on http://localhost:3000..." -ForegroundColor Green
Set-Location (Join-Path $root "frontend")
npm run dev
