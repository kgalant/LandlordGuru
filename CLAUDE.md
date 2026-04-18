# LandlordGuru — Project Instructions

## What this is
A web app for tracking rental property income and expenses across a portfolio of properties.
Node.js/Express backend + PostgreSQL + Google OAuth + multi-tenant workspaces.
Frontend (vanilla JS) served by the backend from the same process.

## Current architecture (v2)
- Backend: Node.js + Express + Knex.js migrations, runs on Linux server with PM2
- Database: PostgreSQL (all data, including audit logs)
- Authentication: Google OAuth 2.0 → JWT in httpOnly cookie
- Frontend: Vanilla JS served by Express; replaced Google Sheets with REST API calls
- Multi-tenancy: All tables carry `workspace_id`; structurally isolated per JWT claim

## Development
- Local dev: `npm install && npm start` from `backend/` — runs on http://localhost:3000
- `.env` file required (see `backend/.env.example`)
- Environment variables: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`

## Production deployment
- Server: SSH `kim@homedev` (see memory: server_access.md)
- Backend runs under PM2: `pm2 start backend/src/index.js`
- Restart: `pm2 restart landlordguru` (or check PM2 app name)
- Logs: `pm2 logs` or check `/var/log/` on server
- Database backups: PostgreSQL dumps on server (managed separately, not in git)

## Security rules
- No credentials ever in git (`.env` is git-ignored)
- `.env` lives on server only — never in the repo
- `backend/.env.example` is the template; fill in actual values on deployment server
- OAuth credentials (Google Cloud Console) must match `FRONTEND_URL` env var

## Coding conventions
- Never add `Co-Authored-By` or similar trailer lines to commits unless explicitly asked

## Versioning
- `version.json` is at the project root (served by frontend `version.html` endpoint)
- Update `version.json` in the same commit as the change: minor bump for new features, patch for fixes
- Add an explicit line to the commit message stating the version changed from x to y
- Tweaking existing features = increment z (`x.y.z`); new major feature = increment y — confirm explicitly
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
- Log format: `req.logger.info(action, parameters)` where `action` is dot-notation (e.g. `'property.create.success'`)
- Include relevant IDs and context in `parameters` (e.g. `property_id`, `user_id`, error message)
- Tests do NOT need to assert on logging — it is a side-effect. Tests verify that the API works.
- Log level is configurable per workspace and per user with automatic expiry — see `docs/LOGGING.md`

## Architectural guidance
- When having conversations about any general architecture topic related to the app,
  consider the input provided from an adversarial angle also.
- Call out key shortcomings if any with the user-suggested approach and propose alternatives
  if there are obvious better ways of doing certain things that are common practice.
- Confirm explicitly with the user before taking any such alternative approach.

## Documentation hygiene
- After any task that adds a feature, renames something, or changes how a system works,
  check whether documentation needs updating or creating before committing:
  - `docs/ARCHITECTURE.md` — v1 vs v2, key decisions, auth design, migration path
  - `docs/data-model.md`   — table schema, field reference, category taxonomy, audit fields
  - `docs/SETUP.md`        — setup steps, file structure, troubleshooting
  - If the change introduces a concept large enough to warrant its own doc
    (e.g. a new subsystem, a non-obvious operational procedure), create a new
    file in `docs/` rather than cramming it into an existing one
- Include doc updates in the same commit as the feature, not a separate one

## Reference docs
- `docs/ARCHITECTURE.md` — v1 vs v2, key decisions, auth design, migration path
- `docs/data-model.md`   — table schema, field reference, category taxonomy, audit fields
- `docs/LOGGING.md`      — log level configuration, resolution chain, per-workspace/per-user overrides
- `docs/SETUP.md`        — v1 only (historical; NAS/Google Sheets setup)
- `docs/BACKEND-SETUP.md` — v2 database setup, Google Cloud OAuth, local dev environment (if exists)

---

# Resumable Workflow Policy

## On every session start

1. Read `AI_STATE.md` — if it doesn't exist, create it.
2. Read the **Goal**, **Current focus**, **Task breakdown**, and **Next step**.
3. Run the last listed Validation commands and report results.
4. Confirm what you are about to do before starting work.

## How to work

- Break all work into milestones small enough to complete in one session.
- Keep exactly one item in **Next step** and at most one subtask marked as **in_progress** in **Task breakdown**.
- Never begin a new milestone until the current one is validated.
- After each step, use the Checkpoint Procedure in `AI_STATE.md` to stay resumable.

## When to update AI_STATE.md

Update `AI_STATE.md` in the same response whenever you:

- Break the current focus into subtasks.
- Change any subtask status (pending → in_progress → completed).
- Switch the Current focus (e.g. feature → bug or bug → feature).
- Finish the Current focus.
- Run validation commands.
- Touch new files.
- Are about to stop the session.

Do not batch updates. Write to `AI_STATE.md` immediately after each of the above events.

---

# AI_STATE.md usage and structure

`AI_STATE.md` is the single source of truth for current work state.  
It must stay small and strictly runtime-focused.

Do **NOT** duplicate design decisions, schema details, or historic milestones here; those live in:

- `docs/data-model.md`
- `docs/01-workspace-user-management.md`
- `docs/02-account-property-management.md`
- `docs/03-transaction-management.md`
- `docs/04-reporting-analytics.md`
- `docs/05-integrations-data-import.md`
- and other docs as appropriate.

The assistant must maintain the following sections in `AI_STATE.md`:

### 1. Goal

- Short 1–2 line statement of the overarching goal.
- Example: “Complete MVP backend + UI for rental tracking (v2), ready for manual end‑to‑end testing in the browser.”

### 2. Current focus

The single item we are actively working on.

Fields:

- Type: `feature` | `bug` | `chore`
- Epic: `E<epic-number> <epic name>`  
  Example: `E2 Account and Property Management`
- ID: feature or bug ID from the relevant epic doc (e.g. `F2.1`, `F3.4`, `BUG-3.1`)
- Title: one-line title from the epic doc  
  Example: `Bulk transaction import endpoint`
- Short summary: 1–2 line human‑readable description  
  Example: `Implement POST /api/transactions/import for CSV import, with validation and batch rollback support.`

When the Title or Short summary in `AI_STATE.md` diverges from the epic doc, update the epic doc to match.
The epic docs are the source of truth for feature/bug definitions.

### 3. Previous focus

If we paused a feature or bug to work on the current focus, record it here so we can resume it later.

Fields:

- Type, Epic, ID, Title, Short summary (same as for Current focus).
- State: `paused` (or another brief state if appropriate).
- Return point: a single sentence describing where to resume.

If nothing is paused, set this section to `None`.

### 4. Task breakdown (current focus)

Break the **Current focus** into small, concrete subtasks.

Representation:

- `[ ]` pending
- `[-]` in_progress
- `[x]` completed

Example:

- `[x] S1: Define request/response shape for POST /api/transactions/import.`
- `[-] S2: Implement validation and all‑or‑nothing batch insert in the backend route.`
- `[ ] S3: Wire import endpoint into UI and show validation errors.`

Subtask rules:

- There must be at most **one** `[-]` entry at any time.
- Before starting work on a new subtask, move any existing `[-]` to `[x]` (done) or `[ ]` (pending/abandoned), then mark the new one as `[-]`.
- Whenever a subtask’s status changes, update this section in the same response.

### 5. Backlog pointers

High‑level pointers only; full details live in epic docs.

Contents:

- A short list of next candidate feature IDs (e.g. `F2.2`, `F3.1`).
- A short list of known bug IDs (e.g. `BUG-2.1`, `BUG-3.1`).
- A list of relevant epic docs (e.g. `docs/02-account-property-management.md`, `docs/03-transaction-management.md`).

Backlog discipline:

- Backlog items live in epic docs, not in `AI_STATE.md`.
- When a new idea or non‑blocking bug comes up during work on the Current focus:
  - Ask the user:

    “Should we:
     (a) add this as a backlog item under the appropriate epic, or
     (b) switch our Current focus to this item now?”

  - If the user chooses **(a)**:
    - Add an ID’ed entry (e.g. `F3.8`, `BUG-3.2`) with a suitable status (e.g. `[backlog]`) in the relevant epic doc.
    - Do **not** change the Current focus in `AI_STATE.md`.
  - If the user chooses **(b)**:
    - Perform a **focus switch** as described below.

### 6. Next step

- A single, concrete action that should happen next.
- It must be specific enough that it can be executed immediately without further planning.

Examples:

- “Run `npm test backend/tests/transactions.test.js` and fix any failing cases in the import logic.”
- “Read `docs/data-model.md` transactions section to confirm fields before updating the schema.”

There must always be exactly one **Next step** in `AI_STATE.md`.

### 7. Validation

- List the commands and checks used to validate the current work (e.g. `npm test`, `npm start`).
- Store the last result:

  - Date/time (local, ISO-like).
  - Outcome (brief summary), such as
    “Tests passing, app boots cleanly, manual browser E2E pending.”

Whenever validation commands are re-run, update the Date/time and Outcome.

### 8. Files touched this session

- List all files (code, docs, `AI_STATE.md`) modified in the current session.
- Update this list as files are touched; do not wait until the end.

### 9. Automation log (latest only)

- Keep exactly **one** automation log entry in `AI_STATE.md`.
- Older entries are moved to an archive file (e.g. `.claude/ai_state_archive.json`) by automation.

Format:

- `<timestamp> <short label>`
  - `branch: <git branch>`
  - `lastcommit: <short commit hash>`
  - `changedfiles: <comma-separated list of files changed since last commit>`
  - `gitstatus: <short git status summary>`

Example:

- `2026-04-18 21:45:00 lifecycle`
  - `branch: main`
  - `lastcommit: 37d1c30`
  - `changedfiles: AI_STATE.md, backend/src/routes/transactions.js`
  - `gitstatus: M AI_STATE.md`

Automation log rules:

- On a new automation log entry:
  - Move the previous entry to the archive file.
  - Replace it in `AI_STATE.md` with the latest entry only.
- Never accumulate multiple entries in `AI_STATE.md`.

---

## Focus switching (feature ↔ bug)

We always have exactly one **Current focus** in `AI_STATE.md`.

When a new feature or bug comes up while working on the Current focus:

1. Ask the user:

   “Should we:
    (a) add this as a backlog item under the appropriate epic, or
    (b) switch our Current focus to this item now?”

2. If the user chooses **(a)**:

   - Add an ID’ed entry with an appropriate status (e.g. `Status: backlog`) in the relevant epic doc.
   - Do **not** change the Current focus in `AI_STATE.md`.

3. If the user chooses **(b)**:

   - Move the existing Current focus into the **Previous focus** section in `AI_STATE.md`, including:
     - Type, Epic, ID, Title, Short summary.
     - A clear **Return point** sentence describing where to resume.
   - Set the new item as **Current focus** and create a fresh **Task breakdown** for it.
   - Ensure only one subtask is marked `[-]` in the new Task breakdown.

After finishing the new focus (e.g. bugfix):

- Mark all its subtasks `[x]`.
- Update the relevant epic doc status (e.g. `Status: done` for `BUG-3.1`).
- Propose resuming the Previous focus and, with user confirmation, move it back into **Current focus** and continue from its Return point.

---

## Before stopping — mandatory

Before your final response in any session, you must:

1. Update subtask statuses (no stale `[-]` entries).
2. Ensure **Current focus**, **Previous focus**, **Task breakdown**, **Next step**, **Validation**, and **Files touched this session** are up to date in `AI_STATE.md`.
3. Write a new **Automation log** entry, replacing the previous one.
4. Make sure `Next step` is a single, concrete action to resume from next time.

---

## On resume

1. Read `AI_STATE.md`.
2. Run the listed Validation commands and report results.
3. State what you are resuming and from where (referencing Current focus and Return point if applicable).
4. Continue with **Next step** only (do not invent a new plan unless explicitly asked).
5. Update `AI_STATE.md` before stopping again.

---

## Global rules for resumability

- Never leave `AI_STATE.md` stale for more than one response turn.
- Never start a new milestone or switch focus without updating `AI_STATE.md` first.
- If context is running low, prioritise writing `AI_STATE.md` over continuing work.
- Maintain exactly one `Next step` and at most one `[-]` (in_progress) subtask at all times.
- Keep `AI_STATE.md` small and human-readable; detailed specs and design live in the epic and data-model docs.