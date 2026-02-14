@echo off
REM Start both Backend and Frontend in development mode (Windows)

echo Starting DeFiScore Development Environment...
echo.

REM Start Backend in new window
start "DeFiScore Backend" cmd /k "cd Backend && python main.py"

REM Wait a bit for backend to start
timeout /t 3 /nobreak > nul

REM Start Frontend in new window
start "DeFiScore Frontend" cmd /k "cd Frontend && npm run dev"

echo.
echo ============================================================
echo DeFiScore is starting...
echo ============================================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:8080
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to stop all services...
pause > nul

REM Kill processes
taskkill /FI "WindowTitle eq DeFiScore Backend*" /T /F
taskkill /FI "WindowTitle eq DeFiScore Frontend*" /T /F
