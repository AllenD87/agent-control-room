#!/bin/bash
# Agent Control Room - One Click Start (zero-install)
set -e

echo "🎮 Agent Control Room"
echo "====================="

# Start backend WS server
echo "🚀 WS server (port 5175)..."
node server/index.js &
WS_PID=$!
sleep 1

# Start mock simulator
echo "🤖 Mock agents..."
node server/simulate.js &
SIM_PID=$!
sleep 1

# Start frontend
echo "🌐 Frontend (port 5174)..."
npx vite --host 0.0.0.0 --port 5174 &
VITE_PID=$!

echo ""
echo "✅ Running: http://localhost:5174/"
echo "Press Ctrl+C to stop"
echo ""

trap "kill \$VITE_PID \$SIM_PID \$WS_PID 2>/dev/null; exit 0" INT
wait
