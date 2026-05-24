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

## Environments

Three environments, all databases on `homedev`:

| Environment | Location | Database | Port | Deploy via |
|-------------|----------|----------|------|-----------|
| Local dev | Local machine | `landlordguru_dev` | 3000 | n/a |
| Test | `homedev:~/dev/landlordguru-test` | `landlordguru_test` | 3001 | `deploy-test.sh` / `deploy-test.ps1` |
| Production | `homedev:~/dev/landlordguru` | `landlordguru_prod` | 3002 | `deploy-prod.sh` |

---

## Local development

The database lives on `homedev`. A tunnel is required before starting the app.

**Normal workflow (one command):**

```bash
cd backend
npm run start:local   # opens SSH tunnel (localhost:5433 → homedev:5432) + starts server
```

Open `http://localhost:3000`.

**First-time setup on a new machine:**

1. Clone the repo
2. `cp backend/.env.example backend/.env` — fill in credentials, leave `DATABASE_URL` pointing to `localhost:5433/landlordguru_dev`
3. Ensure SSH key is configured for `kim@homedev`
4. **Windows (Git Bash):** Add to `~/.bashrc` so the SSH agent loads your key automatically:
   ```bash
   eval $(ssh-agent -s) > /dev/null
   ssh-add ~/.ssh/id_ed25519 2>/dev/null
   ```
5. Open the tunnel, then run migrations to create the schema:
   ```bash
   bash scripts/tunnel.sh   # leave this running in a separate terminal
   cd backend && npm run migrate
   ```
6. Then use `npm run start:local` for normal dev

**Standalone tunnel** (for migrations without starting the server):
```bash
bash scripts/tunnel.sh
```

See `docs/BACKEND-SETUP.md` for detailed setup steps.

---

## Test server deployment

Deploys to `homedev:~/dev/landlordguru-test` (PM2: `landlordguru-test`, port 3001).

```bash
./deploy-test.sh       # bash (Mac or Windows Git Bash)
.\deploy-test.ps1      # PowerShell
```

Steps: push to origin → pull on homedev → run migrations → restart PM2.

---

## Production deployment

Production runs at `homedev:~/dev/landlordguru` (PM2: `landlordguru`, port 3002).

```bash
./deploy-prod.sh
```

Steps: push to origin → pull on homedev → run migrations → restart PM2.

For emergency deploys directly on homedev, `scripts/prod-deploy.sh` remains as a fallback (run on homedev only).

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
