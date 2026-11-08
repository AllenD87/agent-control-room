#!/bin/bash
# Agent Control Room - One Click Start
set -e

echo "🎮 Agent Control Room - One Click Start"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+ first."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi
echo "✅ Dependencies ready"

# Start backend WS server
echo "🚀 Starting WebSocket server (port 5175)..."
node server/index.js &
WS_PID=$!
sleep 1

# Start mock simulator (optional, for demo)
echo "🤖 Starting mock agents simulator..."
node server/simulate.js &
SIM_PID=$!
sleep 1

# Start frontend Vite dev server
echo "🌐 Starting frontend (port 5174)..."
npx vite --host 0.0.0.0 --port 5174 &
VITE_PID=$!

echo ""
echo "========================================"
echo "✅ Agent Control Room is running!"
echo ""
echo "  Frontend:  http://localhost:5174/"
echo "  WS Server: ws://localhost:5175/"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================"

# Open browser (if on desktop)
if command -v xdg-open &> /dev/null; then
  sleep 2
  xdg-open http://localhost:5174/ 2>/dev/null || true
fi

# Wait for Ctrl+C
trap "echo '🛑 Stopping...'; kill $VITE_PID $SIM_PID $WS_PID 2>/dev/null; exit 0" INT
wait
