# LandlordGuru — App-Specific Rules

This file defines all app-specific rules: architecture, coding conventions, testing, versioning, logging, and docs.
For workflow and state-management behaviour, see `CLAUDE.md` and `AI_STATE-GUIDE.md`.

---

## What this is

LandlordGuru is a web app for tracking rental property income and expenses across a portfolio of properties.

- Backend: Node.js + Express + Knex.js migrations
- Database: PostgreSQL (all data, including audit logs)
- Authentication: Google OAuth 2.0 → JWT in httpOnly cookie
- Frontend: Vanilla JS served by Express; replaced Google Sheets with REST API calls
- Multi-tenancy: All tables carry `workspace_id` and are scoped by the JWT claim

---

## Current architecture (v2)

- Backend: Node.js + Express + Knex.js migrations, runs on Linux server with PM2
- Database: PostgreSQL
- Authentication: Google OAuth 2.0 → JWT in httpOnly cookie
- Frontend: Vanilla JS served by Express from the same process
- Multi-tenancy: All tables carry `workspace_id`; structurally isolated per JWT claim

---

## Development

- Local dev: run from `backend/` with `npm install && npm start` — app runs on `http://localhost:3000`
- Environment: `.env` file required (see `backend/.env.example`)
- Required vars: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`
- Code work happens on the local machine. To verify anything in the browser, changes must be committed, pushed, pulled on the test server, and the server restarted.

---

## Test deployment

- Server: SSH `kim@homedev`
- Backend runs under PM2: `pm2 start backend/src/index.js`
- Restart: `pm2 restart landlordguru` (verify actual PM2 app name if unsure)
- Logs: `pm2 logs` or check `/var/log/` on server
- Database backups: PostgreSQL dumps on server (managed separately, not in git)
- Use `deploy.ps1` (Windows) or `deploy.sh` (bash) to automate push → pull → migrate → restart

## Production deployment

TBD

---

## Security rules

- No credentials ever in git (`.env` is git-ignored)
- `.env` lives on server only — never in the repo
- `backend/.env.example` is the template; fill in actual values on the deployment server
- OAuth credentials (Google Cloud Console) must match the `FRONTEND_URL` env var

---

## Coding conventions

- Never add `Co-Authored-By` or similar trailer lines to commits unless explicitly asked

---

## Versioning

- `version.json` is at the project root and is served by a `version.html` endpoint
- Update `version.json` in the **same commit** as any change that affects behaviour
- Semver:
  - Patch (x.y.Z): bug fixes, small tweaks to existing features
  - Minor (x.Y.0): new features — closing out an F-epic-number item from an epic doc; confirm explicitly before bumping
  - Major (X.0.0): only when the user explicitly instructs you to bump major
- Commit messages: include a line like `version: 1.3.2 → 1.3.3`

---

## Test hygiene

After any task that:

- Adds a feature,
- Modifies an API,
- Changes validation, response shape, or behaviour,
- Fixes a bug,

you must:

- Review existing tests and either update them or add new ones, including regression tests for fixed bugs
- New endpoints/routes: add tests in `backend/tests/`
- Changed validation/behaviour: update the relevant existing test file
- Include test changes in the **same commit** as the feature, not a separate one
- Run `npm test` from `backend/` and ensure all tests pass before considering the task done

Tests verify API behaviour, not logging output.

---

## Logging hygiene

All route handlers and backend operations must log their actions.

- Use the injected logger: `req.logger.info()`, `req.logger.error()`, `req.logger.debug()`
- Format: `req.logger.info(action, params)` where:
  - `action` is dot-notation, e.g. `"property.create.success"`
  - `params` includes relevant IDs and context, e.g. `property_id`, `user_id`, any error message
- Tests do **not** assert on logging; logging is a side-effect
- Log level is configurable per workspace and per user with automatic expiry — see `docs/LOGGING.md`

---

## Architectural guidance

When discussing or changing architecture for this app:

- Consider suggestions from an adversarial angle as well as cooperative
- Call out key shortcomings or risks in any proposed approach
- Propose alternatives if there are obviously better, common-practice ways to do it
- Confirm explicitly with the user before switching to any alternative design

---

## Documentation hygiene

Whenever a task adds a feature, renames something, or changes how a system works, check whether docs need updating or adding before committing.

Key docs:

- `docs/ARCHITECTURE.md` — v1 vs v2, key decisions, auth design, migration path
- `docs/data-model.md` — table schemas, field reference, category taxonomy, audit fields
- `docs/SETUP.md` — setup steps, file structure, troubleshooting
- `docs/LOGGING.md` — log level configuration, resolution chain, per-workspace/per-user overrides
- `docs/BACKEND-SETUP.md` — v2 database setup, Google Cloud OAuth, local dev environment

Rules:

- If a change introduces a concept large enough to warrant its own doc (new subsystem, operational procedure), create a new `docs/*.md` file instead of cramming it into an existing one
- Include doc updates in the **same commit** as the feature or fix, not a separate one

---

## Reference docs

- `docs/ARCHITECTURE.md` — v1 vs v2, key decisions, auth design, migration path
- `docs/data-model.md` — table schema, field reference, category taxonomy, audit fields
- `docs/LOGGING.md` — log level configuration, resolution chain, per-workspace/per-user overrides
- `docs/SETUP.md` — v1 only (historical; NAS/Google Sheets setup)
- `docs/BACKEND-SETUP.md` — v2 database setup, Google Cloud OAuth, local dev environment
- `docs/epics/00-index.md` — index of all epics and numbering convention
- `docs/epics/*.md` — individual epics; features are F-e-x (e=epic, x=running number), bugs are B-e-f-y (e=epic, f=feature, y=running number)
