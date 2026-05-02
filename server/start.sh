#!/bin/sh
echo "[start] Setting up Python dependencies..."

# Try direct pip first
python3 -m pip install garminconnect -q 2>/dev/null \
  || pip3 install garminconnect -q 2>/dev/null \
  || {
    # ensurepip may be disabled on Debian/Ubuntu — bootstrap via get-pip.py
    echo "[start] Bootstrapping pip via get-pip.py..."
    curl -sSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py 2>/dev/null \
      && python3 /tmp/get-pip.py --user -q 2>/dev/null \
      && python3 -m pip install garminconnect --user -q 2>/dev/null
  } \
  || echo "[start] Warning: could not install garminconnect"

# Verify
python3 -c "import garminconnect; print('[start] garminconnect OK')" 2>/dev/null \
  || echo "[start] garminconnect still missing"

echo "[start] Starting Node..."
exec node app.js
