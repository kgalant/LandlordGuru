# Deploy script: push locally, pull on remote, restart PM2
# Usage: .\deploy.ps1

$ErrorActionPreference = "Continue"

$stepErrors = @()

Write-Host "=== LandlordGuru Deploy Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Push locally
Write-Host "[1/4] Pushing to origin..." -ForegroundColor Yellow
try {
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
    Write-Host "  -> Push successful" -ForegroundColor Green
} catch {
    Write-Host "  -> Git push failed: $_" -ForegroundColor Red
    $stepErrors += "Step 1 (git push): $_"
}
Write-Host ""

# Steps 2-4: SSH into remote, pull, migrate, restart
# Each remote step records its exit code; a sentinel line carries them back.
Write-Host "[2-4] Connecting to remote server (kim@homedev)..." -ForegroundColor Yellow

$remoteCommands = @'
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

printf '\n__DEPLOY_RESULTS__ git_pull=%d migrate=%d pm2=%d\n' $GIT_PULL_EXIT $MIGRATE_EXIT $PM2_EXIT
'@

$remoteOutput = $remoteCommands | ssh kim@homedev bash -l 2>&1
$sshExit = $LASTEXITCODE

# Print remote output, hiding the internal sentinel line
$remoteOutput | Where-Object { $_ -notmatch '__DEPLOY_RESULTS__' } | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Parse per-step exit codes from sentinel
$resultsLine = $remoteOutput | Where-Object { $_ -match '__DEPLOY_RESULTS__' } | Select-Object -Last 1
if ($resultsLine -match 'git_pull=(\d+) migrate=(\d+) pm2=(\d+)') {
    $gitPullExit = [int]$Matches[1]
    $migrateExit = [int]$Matches[2]
    $pm2Exit     = [int]$Matches[3]

    if ($gitPullExit -ne 0) { $stepErrors += "Step 2 (git pull on remote): exit code $gitPullExit" }
    else                     { Write-Host "  -> Git pull successful" -ForegroundColor Green }

    if ($migrateExit -ne 0) { $stepErrors += "Step 3 (database migrations): exit code $migrateExit" }
    else                    { Write-Host "  -> Migrations successful" -ForegroundColor Green }

    if ($pm2Exit -ne 0) { $stepErrors += "Step 4 (PM2 restart): exit code $pm2Exit" }
    else                { Write-Host "  -> PM2 restart successful" -ForegroundColor Green }
} else {
    $stepErrors += "Steps 2-4 (remote): SSH failed or no results received (SSH exit code $sshExit)"
}

Write-Host ""

# Summary
if ($stepErrors.Count -eq 0) {
    Write-Host "Deployment complete — all steps succeeded." -ForegroundColor Green
    Write-Host "Your changes are live on the dev server." -ForegroundColor Cyan
} else {
    Write-Host "Deployment finished with $($stepErrors.Count) error(s):" -ForegroundColor Yellow
    foreach ($err in $stepErrors) {
        Write-Host "  x $err" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Some steps did not complete. Review the output above for details." -ForegroundColor Yellow
}
