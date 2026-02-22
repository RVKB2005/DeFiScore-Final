@echo off
REM Production Startup Script for Windows

echo =========================================
echo DeFiScore Production Startup
echo =========================================

REM Check if Redis is running
echo Checking Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ERROR: Redis is not running!
    echo Start Redis with: redis-server
    exit /b 1
)
echo [OK] Redis is running

REM Check PostgreSQL
echo Checking PostgreSQL...
python -c "from database import engine; engine.connect()" >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL is not accessible!
    echo Check your DATABASE_URL in .env
    exit /b 1
)
echo [OK] PostgreSQL is accessible

REM Initialize database
echo Initializing database tables...
python init_production_db.py
if errorlevel 1 (
    echo ERROR: Database initialization failed!
    exit /b 1
)
echo [OK] Database initialized

REM Start Celery worker
echo Starting Celery worker...
start "Celery Worker" celery -A celery_app worker --loglevel=info --concurrency=4 -Q scoring,proofs,webhooks --pool=solo

REM Start Celery beat
echo Starting Celery beat...
start "Celery Beat" celery -A celery_app beat --loglevel=info

REM Start Flower
echo Starting Flower monitoring...
start "Flower" celery -A celery_app flower --port=5555
echo [OK] Flower started at http://localhost:5555

REM Start FastAPI
echo Starting FastAPI application...
echo =========================================
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
