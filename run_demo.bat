@echo off
setlocal
echo ========================================================
echo   Starting AgentShield Backend & Frontend for Demo Day
echo ========================================================
echo.

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

:: Detect Python executable
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found on PATH.
    pause
    exit /b 1
)

:: Start Backend in separate window
echo [1/2] Launching Backend on http://localhost:8000 ...
start "AgentShield Backend (Port 8000)" cmd /k "cd /d "%BACKEND_DIR%" && python -m uvicorn main:app --port 8000"

:: Start Frontend in separate window
echo [2/2] Launching Frontend on http://localhost:3000 ...
start "AgentShield Frontend (Port 3000)" cmd /k "cd /d "%FRONTEND_DIR%" && npm.cmd run dev"

echo.
echo ========================================================
echo   Services launched in dedicated console windows!
echo   - Backend:  http://localhost:8000
echo   - Frontend: http://localhost:3000/dashboard/chat
echo.
echo   Press any key to close this launcher launcher window
echo   (Backend and Frontend will keep running).
echo ========================================================
pause >nul
