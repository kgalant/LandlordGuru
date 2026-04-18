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

## Bugs

None recorded.

---

## Dependencies
- All features in this epic are cross-cutting and may depend on or block work in E1–E5.

## Notes
- Features here are infrastructure work items, not user-facing. They do not increment the minor version unless they change observable API behaviour.
- Deployment scripts (`deploy.ps1`, `deploy.sh`) live at the project root, not under `backend/`.
