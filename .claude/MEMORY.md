# Memory Index

- [Always provide full publish command with commit message](feedback_publish_command.md) — include full powershell command + suggested commit message whenever telling user to run publish script
- [No co-authored-by in commits](feedback_commit_coauthor.md) — never add Co-Authored-By or similar trailer lines to commits unless explicitly asked
- [Bump version on new features](feedback_versioning.md) — update version.json (minor bump for features, patch for fixes) in the same commit as the change. Add an explicit line to commit message that version number was changed from x to y. With versions, assume that if we're tweaking main features that exist, we increment the 3rd number (z in x.y.z). If adding a new major feature, we increment the y. Never suggest incrementing the x - the user will explicitly prompt for that.

# LandlordGuru — Project Memory

## What this is
A web app for tracking rental property income and expenses across a portfolio of apartments.
Static HTML/JS frontend, Google Sheets as database, served from a Synology NAS.

## Infrastructure
- NAS: nas.galant.info, SSH on port 1022, user kim
- Web root: /volume1/web/landlordguru/
- Private key location on NAS: /volume1/homes/Kim/private/landlord-guru.pem
- Google Sheets ID: 1vHfLOEJW3dDB7XsaNfj7Q13c706QZO-ot5QebmmKRhQ
- Service account: landlord-guru-service-account@landlordguru.iam.gserviceaccount.com

## Deployment
- .\scripts\publish.ps1 "message" — commits, pushes to GitHub, deploys frontend/ to NAS
- .\scripts\deploy.ps1 — deploys only, no git
- config.js is excluded from deploy (lives on NAS only, never in repo)
- key.php lives on NAS only, never in repo

## Repo structure
- frontend/ — deployable app
- scripts/ — deploy tooling
- docs/ — architecture, setup, data model
- backend/ — empty, scaffolded for future migration
- migrations/ — empty, will hold DB schema when backend is built

## Apartments
- 2 long-term rentals in Denmark (DKK) — Vangede Bygade 77, Gentofte
- 2 short-term rentals in Poland (PLN)
- Model: longterm = fixed rent + a/c heating; airbnb = income tracked as rent

## Key decisions made
- Google Sheets API auth uses a service account with a PEM key file outside the web root
- key.php serves the key only when request includes header X-LandlordGuru: key-request
- config.js contains only non-sensitive settings (spreadsheet ID, service account email)
- No credentials ever in git
- Future migration: Node/Express backend + PostgreSQL, replacing sheets.js and data.js