#!/bin/bash
# Production Startup Script

echo "========================================="
echo "DeFiScore Production Startup"
echo "========================================="

# Check if Redis is running
echo "Checking Redis..."
redis-cli ping > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Redis is not running!"
    echo "Start Redis with: redis-server"
    exit 1
fi
echo "✓ Redis is running"

# Check if PostgreSQL is accessible
echo "Checking PostgreSQL..."
python -c "from database import engine; engine.connect()" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: PostgreSQL is not accessible!"
    echo "Check your DATABASE_URL in .env"
    exit 1
fi
echo "✓ PostgreSQL is accessible"

# Initialize database
echo "Initializing database tables..."
python init_production_db.py
if [ $? -ne 0 ]; then
    echo "ERROR: Database initialization failed!"
    exit 1
fi
echo "✓ Database initialized"

# Start Celery worker in background
echo "Starting Celery worker..."
celery -A celery_app worker --loglevel=info --concurrency=4 -Q scoring,proofs,webhooks &
CELERY_PID=$!
echo "✓ Celery worker started (PID: $CELERY_PID)"

# Start Celery beat for periodic tasks
echo "Starting Celery beat..."
celery -A celery_app beat --loglevel=info &
BEAT_PID=$!
echo "✓ Celery beat started (PID: $BEAT_PID)"

# Start Flower for monitoring (optional)
echo "Starting Flower monitoring..."
celery -A celery_app flower --port=5555 &
FLOWER_PID=$!
echo "✓ Flower started at http://localhost:5555 (PID: $FLOWER_PID)"

# Start FastAPI application
echo "Starting FastAPI application..."
echo "========================================="
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Cleanup on exit
trap "kill $CELERY_PID $BEAT_PID $FLOWER_PID" EXIT
