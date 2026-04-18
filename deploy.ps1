# Deploy script: push locally, pull on remote, restart PM2
# Usage: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== LandlordGuru Deploy Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Push locally
Write-Host "📤 Pushing to origin..." -ForegroundColor Yellow
try {
    git push origin main
    Write-Host "✅ Push successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Git push failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: SSH into remote, pull, restart
Write-Host "🔄 Connecting to remote server (kim@homedev)..." -ForegroundColor Yellow

$remoteCommands = @"
source ~/.nvm/nvm.sh
cd ~/dev/landlordguru
echo '📥 Pulling latest changes...'
git pull origin main
echo '🗄️  Running database migrations...'
cd backend
npm run migrate
echo '🔄 Restarting PM2...'
pm2 restart landlordguru
echo '✅ Remote server updated and restarted'
"@

try {
    $remoteCommands | ssh kim@homedev bash -l
    if ($LASTEXITCODE -ne 0) {
        throw "Remote operations failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Remote operations failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Deployment complete!" -ForegroundColor Green
Write-Host "Your changes are live on the dev server." -ForegroundColor Cyan
