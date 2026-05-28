#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  NetGhost - Network Traffic Visualizer"
echo "============================================"

# Kill any existing instances
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
sleep 1

# Start backend
echo "[1/2] Starting backend (port 8000)..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level warning &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

# Wait for backend
for i in {1..10}; do
  if curl -s http://127.0.0.1:8000/api/status > /dev/null 2>&1; then
    echo "      Backend ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo "[2/2] Starting frontend (port 5173)..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "============================================"
echo "  NetGhost is running!"
echo "  Open: http://localhost:5173"
echo "============================================"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping NetGhost..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  pkill -f "uvicorn main:app" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

wait
