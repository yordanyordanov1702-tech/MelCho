#!/bin/sh
# Install Python dependencies before starting Node
echo "[start] Installing Python dependencies..."
pip3 install -r requirements.txt -q 2>/dev/null \
  || pip install -r requirements.txt -q 2>/dev/null \
  || python3 -m pip install -r requirements.txt -q 2>/dev/null \
  || echo "[start] Warning: pip not found, Python features may not work"

echo "[start] Starting Node server..."
exec node app.js
