#!/bin/sh
echo "[start] Setting up Python dependencies..."

# Ensure pip is available via Python's built-in ensurepip
python3 -m ensurepip --upgrade -q 2>/dev/null || true

# Install garminconnect
python3 -m pip install garminconnect -q 2>/dev/null \
  || pip3 install garminconnect -q 2>/dev/null \
  || pip install garminconnect -q 2>/dev/null \
  || echo "[start] Warning: could not install garminconnect"

# Verify
python3 -c "import garminconnect; print('[start] garminconnect OK')" 2>/dev/null \
  || echo "[start] garminconnect still missing"

echo "[start] Starting Node..."
exec node app.js
