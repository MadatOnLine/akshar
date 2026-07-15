#!/usr/bin/env bash
# Run Akshar mobile on iPhone 13 Simulator (macOS + Xcode required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/packages/mobile"
AUTH="$ROOT/packages/auth"
AI="$ROOT/packages/ai"
MESH="$ROOT/packages/mesh"
CRYPTO="$ROOT/packages/crypto"

export JWT_SECRET="${JWT_SECRET:-akshar-dev-secret-change-in-production-32ch}"
export SERVICE_API_KEY="${SERVICE_API_KEY:-akshar-internal-dev-key}"
export COUCHDB_URL="${COUCHDB_URL:-http://127.0.0.1:5984}"
export COUCHDB_USER="${COUCHDB_USER:-admin}"
export COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-admin}"
export AI_SERVICE_URL="${AI_SERVICE_URL:-http://127.0.0.1:8002}"
export AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://127.0.0.1:8001}"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "ERROR: Xcode is required. Install Xcode from the Mac App Store, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 20+ is required."
  exit 1
fi

wait_for() {
  local url="$1"
  local label="$2"
  echo "Waiting for $label at $url ..."
  for _ in $(seq 1 120); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is ready."
      return 0
    fi
    sleep 1
  done
  echo "ERROR: $label did not start in time."
  exit 1
}

start_backend() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  if lsof -i ":${4:-0}" >/dev/null 2>&1; then
    echo "$name already running."
    return
  fi
  echo "Starting $name ..."
  osascript -e "tell application \"Terminal\" to do script \"cd '$dir' && $cmd\"" >/dev/null
}

echo "==> Akshar iPhone 13 mobile demo (macOS)"
echo "Project: $ROOT"

# Backends (skip if ports already in use)
if ! curl -fsS "http://127.0.0.1:5984" >/dev/null 2>&1; then
  echo "Start CouchDB on port 5984 first (Docker or local install)."
  exit 1
fi

if [ ! -d "$AUTH/.venv-auth" ]; then
  python3.11 -m venv "$AUTH/.venv-auth"
  "$AUTH/.venv-auth/bin/pip" install -q -r "$AUTH/requirements.txt"
fi
if [ ! -d "$AI/.venv-ai" ]; then
  python3.11 -m venv "$AI/.venv-ai"
  "$AI/.venv-ai/bin/pip" install -q --default-timeout=300 -r "$AI/requirements.txt"
fi

start_backend "Auth :8001" "$AUTH" \
  "JWT_SECRET='$JWT_SECRET' COUCHDB_URL='$COUCHDB_URL' COUCHDB_USER='$COUCHDB_USER' COUCHDB_PASSWORD='$COUCHDB_PASSWORD' '$AUTH/.venv-auth/bin/python' -m uvicorn app.main:app --host 127.0.0.1 --port 8001" \
  8001

start_backend "AI :8002" "$AI" \
  "JWT_SECRET='$JWT_SECRET' SERVICE_API_KEY='$SERVICE_API_KEY' COUCHDB_URL='$COUCHDB_URL' COUCHDB_USER='$COUCHDB_USER' COUCHDB_PASSWORD='$COUCHDB_PASSWORD' '$AI/.venv-ai/bin/python' -m uvicorn app.main:app --host 127.0.0.1 --port 8002" \
  8002

if [ ! -d "$CRYPTO/node_modules" ]; then
  (cd "$CRYPTO" && npm install && npm run build)
fi
if [ ! -d "$MESH/node_modules" ]; then
  (cd "$MESH" && npm install)
fi

start_backend "Mesh :8003" "$MESH" \
  "JWT_SECRET='$JWT_SECRET' SERVICE_API_KEY='$SERVICE_API_KEY' COUCHDB_URL='http://admin:admin@127.0.0.1:5984' AI_SERVICE_URL='$AI_SERVICE_URL' AUTH_SERVICE_URL='$AUTH_SERVICE_URL' npm run dev" \
  8003

wait_for "http://127.0.0.1:8001/auth/health" "Auth"
wait_for "http://127.0.0.1:8002/ai/health" "AI"
wait_for "http://127.0.0.1:8003/mesh/health" "Mesh"

echo "==> Installing mobile dependencies"
cd "$MOBILE"
npm install

echo "==> Installing CocoaPods"
cd ios
if command -v pod >/dev/null 2>&1; then
  pod install
else
  npx pod-install
fi
cd ..

SIM_NAME="iPhone 13"
echo "==> Booting $SIM_NAME simulator"
xcrun simctl boot "$SIM_NAME" 2>/dev/null || true
open -a Simulator

echo "==> Building and launching on $SIM_NAME"
npx react-native run-ios --simulator="$SIM_NAME"

echo ""
echo "Akshar mobile is running on $SIM_NAME."
echo "Leave the Auth, AI, and Mesh terminal windows open during your demo."
