@echo off
REM Full stack setup script for DeFiScore (Windows)

echo ============================================================
echo DeFiScore Full Stack Setup
echo ============================================================

REM Backend Setup
echo.
echo [1/4] Setting up Backend...
cd Backend
if not exist .env (
    python setup.py
    if errorlevel 1 (
        echo Error: Backend setup failed
        exit /b 1
    )
) else (
    echo Backend already configured
)
cd ..

REM Frontend Setup
echo.
echo [2/4] Setting up Frontend...
cd Frontend
if not exist node_modules (
    echo Installing Frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo Error: Frontend setup failed
        exit /b 1
    )
) else (
    echo Frontend dependencies already installed
)

REM Ensure ethers.js is installed
echo Ensuring ethers.js is installed...
call npm install ethers@6.13.0

if not exist .env (
    echo Creating Frontend .env file...
    copy .env.example .env
    echo VITE_API_BASE_URL=http://localhost:8000 > .env
    echo VITE_ENVIRONMENT=development >> .env
)
cd ..

echo.
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo To start the application:
echo.
echo 1. Start Backend (Terminal 1):
echo    cd Backend
echo    python main.py
echo.
echo 2. Start Frontend (Terminal 2):
echo    cd Frontend
echo    npm run dev
echo.
echo 3. Open browser:
echo    http://localhost:8080
echo.
echo ============================================================
