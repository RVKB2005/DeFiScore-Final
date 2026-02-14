#!/bin/bash
# Full stack setup script for DeFiScore (Linux/Mac)

echo "============================================================"
echo "DeFiScore Full Stack Setup"
echo "============================================================"

# Backend Setup
echo ""
echo "[1/4] Setting up Backend..."
cd Backend
if [ ! -f .env ]; then
    python3 setup.py
    if [ $? -ne 0 ]; then
        echo "Error: Backend setup failed"
        exit 1
    fi
else
    echo "Backend already configured"
fi
cd ..

# Frontend Setup
echo ""
echo "[2/4] Setting up Frontend..."
cd Frontend
if [ ! -d node_modules ]; then
    echo "Installing Frontend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Frontend setup failed"
        exit 1
    fi
else
    echo "Frontend dependencies already installed"
fi

# Ensure ethers.js is installed
echo "Ensuring ethers.js is installed..."
npm install ethers@6.13.0

if [ ! -f .env ]; then
    echo "Creating Frontend .env file..."
    cp .env.example .env
    echo "VITE_API_BASE_URL=http://localhost:8000" > .env
    echo "VITE_ENVIRONMENT=development" >> .env
fi
cd ..

echo ""
echo "============================================================"
echo "Setup Complete!"
echo "============================================================"
echo ""
echo "To start the application:"
echo ""
echo "1. Start Backend (Terminal 1):"
echo "   cd Backend"
echo "   python main.py"
echo ""
echo "2. Start Frontend (Terminal 2):"
echo "   cd Frontend"
echo "   npm run dev"
echo ""
echo "3. Open browser:"
echo "   http://localhost:8080"
echo ""
echo "============================================================"
