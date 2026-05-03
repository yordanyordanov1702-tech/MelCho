#!/bin/sh
echo "[start] === Garmin setup ==="
echo "[start] python3: $(which python3 2>/dev/null || echo 'NOT FOUND')"
echo "[start] python3 version: $(python3 --version 2>&1 || echo 'N/A')"
echo "[start] pip: $(python3 -m pip --version 2>&1 || echo 'NOT FOUND')"

DEPS_DIR="$(cd "$(dirname "$0")" && pwd)/python_deps"
mkdir -p "$DEPS_DIR"
echo "[start] deps dir: $DEPS_DIR"

if python3 -c "import garminconnect" 2>/dev/null; then
  echo "[start] garminconnect already in system path"
else
  echo "[start] Installing garminconnect --target $DEPS_DIR ..."
  python3 -m pip install garminconnect --target "$DEPS_DIR" 2>&1
  echo "[start] pip exit code: $?"
fi

# Verify with local deps on path
python3 - <<'EOF'
import sys, os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else '.', 'python_deps')
# fallback: check current dir
for candidate in [d, './python_deps', '/opt/render/project/src/server/python_deps']:
    if os.path.isdir(candidate):
        sys.path.insert(0, candidate)
        break
try:
    import garminconnect
    print('[start] garminconnect OK — version:', getattr(garminconnect, '__version__', 'unknown'))
except ImportError as e:
    print('[start] garminconnect MISSING:', e)
EOF

echo "[start] Starting Node..."
exec node app.js
