# LandlordGuru — Project Instructions

## What this is
A web app for tracking rental property income and expenses across a portfolio of properties.
Static HTML/JS frontend, Google Sheets as database, served from a Synology NAS.

## Infrastructure
- NAS: nas.galant.info, SSH on port 1022, user kim
- Web root: /volume1/web/landlordguru/
- Private key location on NAS: /volume1/homes/Kim/private/landlord-guru.pem

## Deployment
- `.\scripts\publish.ps1 "message"` — commits, pushes to GitHub, deploys frontend/ to NAS
- `.\scripts\deploy.ps1` — deploys only, no git
- Always provide the full deploy command when telling the user to run the deploy script
- config.js is excluded from deploy (lives on NAS only, never in repo)

## Security rules
- No credentials ever in git
- config.js contains only non-sensitive settings (spreadsheet ID, service account email)
- key.php serves the PEM key only when the request includes header `X-LandlordGuru: key-request`

## Coding conventions
- Never add Co-Authored-By or similar trailer lines to commits unless explicitly asked

## Versioning
- Update version.json in the same commit as the change: minor bump for new features, patch for fixes
- Add an explicit line to the commit message stating the version changed from x to y
- Tweaking existing features = increment z (x.y.z); new major feature = increment y
- Never suggest incrementing x — the user will prompt for that explicitly

## Documentation hygiene
- After any task that adds a feature, renames something, or changes how a system works,
  check whether any of the following need updating before committing:
  - `docs/ARCHITECTURE.md` — file tree, sheet tab list, constraints
  - `docs/data-model.md`   — field names, new sheets/tables, schema notes
  - `docs/SETUP.md`        — setup steps, file structure, troubleshooting
- Include doc updates in the same commit as the feature, not a separate one

## Reference docs
- @docs/SETUP.md — infrastructure details, credentials locations, Google Sheets config
- @docs/data-model.md — property portfolio, rental types, income/expense model
- @docs/ARCHITECTURE.md — key decisions, auth design, future migration plan
