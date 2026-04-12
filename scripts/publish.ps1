# scripts/publish.ps1
# Commit, push to GitHub, and deploy to NAS in one step.
#
# Usage: .\scripts\publish.ps1 "Your commit message"

param(
    [string]$Message = "Update"
)

Write-Host "Publishing: $Message" -ForegroundColor Cyan

git add .
git commit -m $Message
git push

& "$PSScriptRoot\deploy.ps1"
