#!/bin/sh
echo "[start] Setting up Python dependencies..."

# Install garminconnect to a local folder — no root/sudo/system-pip needed
# --target bypasses PEP 668 (EXTERNALLY-MANAGED) entirely
DEPS_DIR="$(dirname "$0")/python_deps"
mkdir -p "$DEPS_DIR"

if python3 -c "import garminconnect" 2>/dev/null; then
  echo "[start] garminconnect already available"
elif [ "$(ls -A "$DEPS_DIR" 2>/dev/null)" ]; then
  echo "[start] python_deps folder exists, skipping install"
else
  echo "[start] Installing garminconnect to $DEPS_DIR ..."
  python3 -m pip install garminconnect --target "$DEPS_DIR" -q 2>&1 \
    || pip3 install garminconnect --target "$DEPS_DIR" -q 2>&1 \
    || echo "[start] Warning: pip install failed"
fi

# Verify
python3 -c "
import sys, os
d = os.path.join(os.path.dirname('$DEPS_DIR'), 'python_deps')
if os.path.isdir(d): sys.path.insert(0, d)
import garminconnect
print('[start] garminconnect OK')
" 2>/dev/null || echo "[start] garminconnect still missing"

echo "[start] Starting Node..."
exec node app.js
