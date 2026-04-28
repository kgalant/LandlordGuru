#!/usr/bin/env bash
# Deploy script: push locally, pull on remote, restart PM2
# Usage: ./deploy.sh
# Works from any machine — detects if already on homedev and skips SSH if so.

set -euo pipefail

step_errors=()

echo "=== LandlordGuru Deploy Script ==="
echo ""

# Step 1: Push locally (always — ensures changes are in the remote)
echo "[1/4] Pushing to origin..."
if git push origin main; then
    echo "  -> Push successful"
else
    step_errors+=("Step 1 (git push): exit code $?")
fi
echo ""

# Steps 2-4: Pull, migrate, restart
# Run directly if already on homedev, otherwise SSH in.
remote_script='
set +e
source ~/.nvm/nvm.sh

cd ~/dev/landlordguru
echo "[2/4] Pulling latest changes..."
git pull origin main
GIT_PULL_EXIT=$?
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "{\"git_commit\":\"$GIT_COMMIT\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > frontend/build.json

echo "[3/4] Running database migrations..."
cd backend
npm run migrate
MIGRATE_EXIT=$?

echo "[4/4] Restarting PM2 (commit: $GIT_COMMIT)..."
GIT_COMMIT=$GIT_COMMIT pm2 restart landlordguru --update-env
PM2_EXIT=$?

printf "\n__DEPLOY_RESULTS__ git_pull=%d migrate=%d pm2=%d\n" $GIT_PULL_EXIT $MIGRATE_EXIT $PM2_EXIT
'

if [[ "$(hostname)" == "homedev" ]]; then
    echo "[2-4] Running on homedev directly..."
    remote_output=$(echo "$remote_script" | bash -l)
    ssh_exit=$?
else
    echo "[2-4] Connecting to remote server (kim@homedev)..."
    remote_output=$(echo "$remote_script" | ssh kim@homedev bash -l)
    ssh_exit=$?
fi

# Print remote output, hiding the sentinel line
echo "$remote_output" | grep -v '__DEPLOY_RESULTS__' | while IFS= read -r line; do
    echo "  $line"
done
echo ""

# Parse per-step exit codes from sentinel
results_line=$(echo "$remote_output" | grep '__DEPLOY_RESULTS__' | tail -1)
if [[ "$results_line" =~ git_pull=([0-9]+)\ migrate=([0-9]+)\ pm2=([0-9]+) ]]; then
    git_pull_exit=${BASH_REMATCH[1]}
    migrate_exit=${BASH_REMATCH[2]}
    pm2_exit=${BASH_REMATCH[3]}

    if [[ $git_pull_exit -ne 0 ]]; then
        step_errors+=("Step 2 (git pull on remote): exit code $git_pull_exit")
    else
        echo "  -> Git pull successful"
    fi

    if [[ $migrate_exit -ne 0 ]]; then
        step_errors+=("Step 3 (database migrations): exit code $migrate_exit")
    else
        echo "  -> Migrations successful"
    fi

    if [[ $pm2_exit -ne 0 ]]; then
        step_errors+=("Step 4 (PM2 restart): exit code $pm2_exit")
    else
        echo "  -> PM2 restart successful"
    fi
else
    step_errors+=("Steps 2-4 (remote): failed or no results received (exit code $ssh_exit)")
fi

echo ""

# Summary
deployed_commit=$(echo "$remote_output" | grep -oP 'commit: \K[a-f0-9]+' | tail -1)

if [[ ${#step_errors[@]} -eq 0 ]]; then
    echo "Deployment complete — all steps succeeded."
    echo "Your changes are live on the dev server."
    [[ -n "$deployed_commit" ]] && echo "Server is running commit: $deployed_commit"
else
    echo "Deployment finished with ${#step_errors[@]} error(s):"
    for err in "${step_errors[@]}"; do
        echo "  x $err"
    done
    echo ""
    echo "Some steps did not complete. Review the output above for details."
fi
