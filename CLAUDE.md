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

## Test hygiene
- After any task that adds a feature, modifies an API, or would cause a version number to increment,
  review existing tests and determine whether they need updating or new tests need to be added:
  - New endpoint or route → add a test file in `backend/tests/`
  - Changed validation rules, response shape, or behaviour → update the relevant test
  - New edge case or bug fix → add a regression test
- Include test changes in the same commit as the feature, not a separate one
- Run `npm test` (from `backend/`) before committing to confirm all tests pass

## Logging hygiene
- All route handlers and backend operations must log their actions: use `req.logger.info()`, `req.logger.error()`, or `req.logger.debug()`
- Log format: `req.logger.info(action, parameters)` where action is dot-notation (e.g. `'property.create.success'`)
- Include relevant IDs and context in parameters (e.g. property_id, user_id, error message)
- Tests do NOT need to assert on logging — it is a side-effect. Tests verify that the API works.
- Log level is configurable per workspace and per user with automatic expiry — see `docs/LOGGING.md`

## Architectural guidance
- When having conversations about any general architecture topic related to the app, consider the input provided from an adversarial angle also. Call out key shortcomings if any with the user-suggested approach and propose alternatives if there are obvious better ways of doing certain things that are common practice. Confirm explicitly with the user before taking any such alternative approach.


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

# Resumable Workflow Policy

## On every session start
1. Read AI_STATE.md — if it doesn't exist, create it
2. Read the Goal and Current phase
3. Run the last listed Validation commands and report results
4. Confirm what you are about to do before starting work

## How to work
Break all work into milestones small enough to complete in one session.
Keep exactly one item in **Next step** and at most one item in **In progress**.
Never begin a new milestone until the current one is validated.

## Update AI_STATE.md after every response where you:
- Complete a milestone
- Make a decision
- Touch a file
- Hit a blocker
- Are about to stop for any reason

Do not batch updates. Write to AI_STATE.md immediately after each of the above events.

## Before stopping — mandatory
Before your final response in any session, write a closing update to AI_STATE.md:
- Move completed work into Completed
- Set In progress to what was interrupted (if anything)
- Set Next step to the single next action
- List all files touched this session
- Record any decisions made
- Record validation results

## On resume
1. Read AI_STATE.md
2. Run the listed Validation commands
3. State what you are resuming and from where
4. Continue with Next step only
5. Update AI_STATE.md before stopping again

## Automation log (in AI_STATE.md)

Keep ONE automation log entry per session at the end of AI_STATE.md:
- **Format:** timestamp, branch, last_commit, changed_files, git_status
- **On new entry:** move the previous entry to `.claude/ai_state_archive.json` (JSON array, append to end)
- **Purpose:** track state changes for context without bloating the active file
- **Rule:** always replace the old entry, never accumulate multiple entries in AI_STATE.md

## Rules
- Never leave AI_STATE.md stale for more than one response turn
- Never start a new milestone without updating AI_STATE.md first
- If context is running low, prioritise writing AI_STATE.md over continuing work
- One active Next step at all times — never a list, never vague
- Automation log: keep only the latest entry in AI_STATE.md; archive older entries
