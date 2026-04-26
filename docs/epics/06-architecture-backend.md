# Epic 6 — Architecture and Backend

## Goal
Maintain and improve the technical foundation of the application: deployment, infrastructure, database management, API hardening, observability, and performance. These are not user-facing features but are prerequisites for reliability and long-term maintainability.

## Status
In progress.

---

## Features

### F6-1 Deployment automation `[Done]`
**Status:** Done

Automated scripts to push code, pull on the server, run migrations, and restart PM2.

**Acceptance criteria:**
- `deploy.ps1`: Windows PowerShell script that chains git push → SSH → git pull → npm run migrate → pm2 restart
- `deploy.sh`: Bash equivalent for Linux/WSL users
- Both scripts source NVM to ensure `npm` and `pm2` are available in the remote shell

---

### F6-2 Database migration discipline `[Planned]`
**Status:** Planned

Ensure all schema changes are captured as numbered Knex migrations and applied consistently across environments.

**Acceptance criteria:**
- All schema changes go through `knex migrate:make` — no manual SQL
- `npm run migrate` is idempotent and safe to re-run
- Migration history is committed to git
- README or BACKEND-SETUP.md documents how to run migrations on a fresh environment

---

### F6-3 API security hardening `[Planned]`
**Status:** Planned

Apply standard HTTP security practices to the Express backend.

**Acceptance criteria:**
- `helmet` middleware (or equivalent) sets security headers on all responses
- Rate limiting on auth endpoints (at minimum `/auth/google` and `/auth/callback`)
- CORS configured to allow only expected origins (controlled by `FRONTEND_URL` env var)
- No stack traces or internal error details exposed to clients in production

---

### F6-4 Observability and log management `[Planned]`
**Status:** Planned

Ensure the app's runtime behaviour is inspectable in production.

**Acceptance criteria:**
- PM2 log rotation configured to prevent unbounded disk growth
- Application logs (via `req.logger`) are structured and grep-friendly
- A documented procedure exists for checking server health and recent errors

---

### F6-5 Environment and secrets management `[Planned]`
**Status:** Planned

Formalise how environment configuration is managed across local and server environments.

**Acceptance criteria:**
- `backend/.env.example` is kept in sync with all required vars
- A documented checklist exists for provisioning a new environment (server setup, OAuth credentials, DB connection)
- No secrets ever appear in git history (verified by a tool such as `git-secrets` or equivalent)

---

### F6-6 Frontend debug panel `[Done]`
**Status:** Done

A discreet debug panel accessible via a version label in the bottom-right corner of every authenticated page. Intended for developers and operators checking runtime state; it is deliberately low-visibility and does not draw attention in normal use.

**Entry point:**
- A version string (e.g. `v0.1.0`) is rendered in the bottom-right corner of the authenticated layout on every page
- Style: very small font, low-contrast muted colour (intentionally unobtrusive — reads as a footnote, not a button)
- Clicking the label toggles the debug panel open; clicking it again or pressing Escape closes it

**Debug panel contents:**

| Field | Description |
|---|---|
| Frontend version | Semver string + short git commit hash, injected at build time via an environment variable |
| Backend version | Fetched from `GET /api/version`; shows "unavailable" if the request fails |
| Environment | `development` or `production`, derived from `NODE_ENV` or equivalent |
| Authenticated user | Display name, email address, and workspace ID of the current session |
| Auth token expiry | Remaining TTL of the JWT in human-readable form (e.g. "expires in 4 h 12 m") |
| Last sync | Timestamp of the most recent data refresh |
| API health | Status and latency of the most recent API call or a dedicated health ping (e.g. "OK — 42 ms") |

**Backend endpoint — `GET /api/version`:**
- Returns `{ version, environment, commit }`:
  - `version` — value of `version` field from `backend/package.json`
  - `environment` — value of `NODE_ENV`
  - `commit` — value of `GIT_COMMIT` env var, injected at deploy time by `deploy.ps1` / `deploy.sh`; falls back to `"unknown"` if not set
- No authentication required (safe to call before session is established)
- Must not expose secrets, internal paths, or stack traces

**Acceptance criteria:**
- The version label is visible in the bottom-right corner on every page after login
- The label is intentionally low-visibility and does not draw the eye in normal use
- Clicking the label opens the debug panel; clicking it again or pressing Escape closes it
- The panel displays all fields in the table above
- If `GET /api/version` fails or times out, the backend version row shows "unavailable" — the panel does not crash or hide
- `GET /api/version` is implemented on the backend and returns the correct `{ version, environment, commit }` shape
- The panel is shown only to authenticated users; the version label itself may be visible to unauthenticated pages but the panel requires a valid session to open

**Dependencies:** F6-4 (observability — planned); the `GIT_COMMIT` injection must be added to `deploy.ps1` and `deploy.sh` as part of this feature.

---

## Bugs

None recorded.

---

## Dependencies
- All features in this epic are cross-cutting and may depend on or block work in E1–E5.

## Notes
- Features here are infrastructure work items, not user-facing. They do not increment the minor version unless they change observable API behaviour.
- Deployment scripts (`deploy.ps1`, `deploy.sh`) live at the project root, not under `backend/`.
- Automated currency rate refresh (F2-10) requires scheduled backend job infrastructure. When F2-10 is implemented, recurring server-side job support (PM2 scheduled tasks or equivalent) must be in place — this should be tracked as a subtask of F2-10 or as a new F6 item at that time.
