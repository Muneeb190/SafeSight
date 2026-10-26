@echo off
title SafeSight AI Development Launcher
echo ==========================================
echo  Starting SafeSight AI Development System
echo ==========================================

echo [1/2] Launching Backend on http://localhost:8080...
start "SafeSight Backend API" powershell -ExecutionPolicy Bypass -NoExit -Command "cd '%~dp0backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"

echo [2/2] Launching Frontend on http://localhost:3000...
cd "%~dp0frontend"
npm run dev
