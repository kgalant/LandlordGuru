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
- Tweaking existing features = increment z (x.y.z); new major feature = increment y - confirm explicitly
- Never suggest incrementing x — the user will prompt for that explicitly

## Documentation hygiene
- After any task that adds a feature, renames something, or changes how a system works,
  check whether documentation needs updating or creating before committing:
  - `docs/ARCHITECTURE.md` — file tree, sheet tab list, constraints
  - `docs/data-model.md`   — field names, new sheets/tables, schema notes
  - `docs/SETUP.md`        — setup steps, file structure, troubleshooting
  - If the change introduces a concept large enough to warrant its own doc
    (e.g. a new subsystem, a non-obvious operational procedure), create a new
    file in `docs/` rather than cramming it into an existing one
- Include doc updates in the same commit as the feature, not a separate one

## Reference docs
- @docs/SETUP.md — infrastructure details, credentials locations, Google Sheets config
- @docs/data-model.md — property portfolio, rental types, income/expense model
- @docs/ARCHITECTURE.md — key decisions, auth design, future migration plan

## Resumable Workflow Policy

Read AI_STATE.md before starting any work. If it does not exist, create it.

Break all work into milestones small enough to complete in a single session.
Always keep exactly one item in **Next step** and at most one item in **In progress**.

After every completed milestone, update AI_STATE.md:
- Completed
- In progress
- Next step
- Files touched
- Decisions
- Validation (commands + pass/fail)
- Blockers

Before stopping for any reason — context limit, interruption, end of task —
write a final update to AI_STATE.md.

When resuming:
1. Read AI_STATE.md
2. Run `git status` and `git diff`
3. Re-run the last listed validation commands
4. Continue only with **Next step**
5. Update AI_STATE.md again before stopping

Never begin a new milestone until the current one is validated and
AI_STATE.md reflects the current state.
