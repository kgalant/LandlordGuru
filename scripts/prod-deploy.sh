#!/usr/bin/env bash
# Production deploy — run on homedev only.
# Usage: SSH into homedev, then: bash ~/dev/landlordguru/scripts/prod-deploy.sh
# Do NOT run this from a local machine.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ "$(hostname)" != "homedev" ]]; then
    echo "ERROR: This script must be run on homedev, not from a remote machine."
    echo "SSH in first: ssh kim@homedev"
    exit 1
fi

echo "=== LandlordGuru Deploy → PRODUCTION ==="
echo ""

echo "[1/3] Pulling latest changes..."
git pull origin main
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "{\"git_commit\":\"$GIT_COMMIT\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > frontend/build.json
echo "  -> Pull successful (commit: $GIT_COMMIT)"
echo ""

echo "[2/3] Running database migrations..."
cd backend
npm run migrate
echo "  -> Migrations successful"
echo ""

echo "[3/3] Restarting PM2..."
GIT_COMMIT=$GIT_COMMIT pm2 restart landlordguru --update-env
echo "  -> PM2 restart successful"
echo ""

echo "Deployment complete. Production is running commit: $GIT_COMMIT"
