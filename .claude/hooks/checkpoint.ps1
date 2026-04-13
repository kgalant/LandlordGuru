# checkpoint.ps1
# Appends a git-state checkpoint to AI_STATE.md on every Claude lifecycle event.
# Requires PowerShell 7+ (pwsh). Run from project root.

param()
$ErrorActionPreference = 'Stop'

# Read hook event JSON from stdin (Claude passes this automatically)
$hookInput = $null
try { $hookInput = $input | ConvertFrom-Json } catch { $hookInput = $null }

# Find repo root, fall back to current directory if not a git repo
try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null).Trim()
} catch { $repoRoot = $null }
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }

$stateFile = Join-Path $repoRoot "AI_STATE.md"
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Create AI_STATE.md if it doesn't exist
if (-not (Test-Path $stateFile)) {
    Set-Content -Path $stateFile -Encoding utf8 @"
# AI State

## Goal


## Current phase


## Completed
-

## In progress
-

## Next step
-

## Files touched
-

## Decisions
-

## Validation
-

## Blockers
-

## Resume prompt
Read this file, run ``git status`` and the listed validation commands,
then continue from Next step only.
"@
}

# Gather git state
try { $branch     = (git -C $repoRoot branch --show-current 2>$null).Trim() } catch { $branch = "" }
try { $lastCommit = (git -C $repoRoot log -1 --pretty=format:"%h %s" 2>$null).Trim() } catch { $lastCommit = "" }
try {
    $changedFiles = @(
        git -C $repoRoot diff --name-only 2>$null
        git -C $repoRoot diff --cached --name-only 2>$null
    ) | Where-Object { $_ } | Sort-Object -Unique
} catch { $changedFiles = @() }
try {
    $gitStatus = (git -C $repoRoot status --short 2>$null) -join "`n"
} catch { $gitStatus = "" }

# Get event name from hook JSON (e.g. "Stop", "SessionEnd", "PostCompact")
$eventName = "lifecycle"
if ($hookInput -and $hookInput.hook_event_name) {
    $eventName = $hookInput.hook_event_name
}

# Ensure the Automation log section exists at the bottom of the file
$content = Get-Content $stateFile -Raw -Encoding utf8
if ($content -notmatch '(?m)^## Automation log') {
    Add-Content -Path $stateFile -Encoding utf8 -Value "`n## Automation log"
}

# Build and append the checkpoint block
$lines = @("", "- $now [$eventName]")
if ($branch)     { $lines += "  - branch: $branch" }
if ($lastCommit) { $lines += "  - last_commit: $lastCommit" }
if ($changedFiles.Count -gt 0) {
    $lines += "  - changed_files: " + ($changedFiles -join ", ")
}
if ($gitStatus) {
    $lines += "  - git_status:"
    foreach ($line in ($gitStatus -split "`n")) {
        if ($line.Trim()) { $lines += "    $line" }
    }
}

Add-Content -Path $stateFile -Encoding utf8 -Value ($lines -join "`n")
exit 0