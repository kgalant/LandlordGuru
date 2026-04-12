# scripts/deploy.ps1
# Deploy frontend/ to NAS using scp, preserving config.js
#
# Usage: .\scripts\deploy.ps1

$NAS_USER = "kim"
$NAS_HOST = "nas.galant.info"
$NAS_PORT = "1022"
$NAS_PATH = "/volume1/web/landlordguru"
$LOCAL_FRONTEND = ".\frontend"

Write-Host "Deploying frontend/ to ${NAS_HOST}:${NAS_PATH}..." -ForegroundColor Cyan

# Build list of files to deploy, excluding config.js
$files = Get-ChildItem -Path $LOCAL_FRONTEND -Recurse -File |
    Where-Object { $_.Name -ne "config.js" }

foreach ($file in $files) {
    # Get the relative path from frontend/
    $relativePath = $file.FullName.Substring((Resolve-Path $LOCAL_FRONTEND).Path.Length + 1)
    $relativePath = $relativePath.Replace("\", "/")
    
    # Build remote path
    $remotePath = "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/${relativePath}"
    
    # Ensure remote directory exists
    $remoteDir = "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/" + ($relativePath | Split-Path -Parent).Replace("\", "/")
    
    Write-Host "  Uploading $relativePath" -ForegroundColor Gray
    scp -O -P $NAS_PORT $file.FullName "${NAS_USER}@${NAS_HOST}:${NAS_PATH}/${relativePath}"
}

Write-Host "Done." -ForegroundColor Green
