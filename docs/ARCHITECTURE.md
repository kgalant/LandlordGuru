# Architecture

## Current state (v1 — static + Google Sheets)

```
Browser
  └── frontend/index.html         (served by Synology Web Station)
        ├── js/strings.js         Internationalisation — t() function, hardcoded EN defaults
        ├── js/sheets.js          Google Sheets API via WebCrypto JWT auth
        ├── js/data.js            Maps sheet rows ↔ JS objects
        ├── js/importer.js        CSV parsing, column auto-detection, bank profiles, rules
        ├── js/reports.js         Filtering, aggregation, P&L — pure functions
        └── js/debug.js           Debug panel (append ?debug to URL)

        key.php                   Serves private key from outside web root
        debug.inc.php             PHP logger used by key.php
        version.json              App version — bumped on every feature release

Google Sheet (acts as database)
  ├── properties tab
  ├── transactions tab
  ├── rules tab
  ├── fx_log tab
  └── strings tab                 User/language overrides for UI strings
```

**Constraints of this architecture:**
- `config.js` (credentials) must be served as a static file — the NAS must not be public-facing without password protection
- The private key is kept outside the web root and served by `key.php`; it never appears in `config.js`
- No server-side logic; all API calls go directly from the browser to Google
- Concurrent writes from two users simultaneously could cause a race condition (acceptable at this portfolio size)
- Google Sheets API quota: 300 requests/minute (vastly more than needed)

---

## Current state (v2 — backend in development)

```
Browser
  └── frontend/                   (vanilla JS, served by Express)
        ├── js/strings.js         (unchanged — i18n layer)
        ├── js/importer.js        (unchanged — pure CSV logic)
        ├── js/reports.js         (unchanged — pure aggregation logic)
        ├── js/auth.js            (Google OAuth login, JWT token management, logout)
        └── js/api.js             (REST client calling backend /api/* routes)
              ↕  HTTPS (landlordguru.galant.info)
backend/ (Node.js + Express)
  ├── src/index.js              Express app, session + passport setup, static frontend serving
  ├── src/lib/
  │   └── logger.js             Structured logger — injected as req.logger by auth middleware
  ├── src/routes/
  │   ├── auth.js               GET /auth/google, /auth/google/callback, POST /logout
  │   ├── health.js             GET /api/health (for monitoring)
  │   ├── properties.js         GET/POST/PATCH/DELETE /api/properties ✅
  │   ├── transactions.js       GET/POST/PATCH/DELETE /api/transactions ✅
  │   └── rules.js              GET/POST/PATCH/DELETE /api/rules (todo)
  ├── src/middleware/
  │   ├── auth.js               JWT verification, req.user + workspace_id + req.logger injection
  │   └── errors.js             Error handler (todo)
  └── src/db/migrations/         Knex.js schema migrations (001-012)
              ↕  PostgreSQL
        9 tables: workspaces, users, workspace_users, properties, accounts,
                  account_properties, transactions, rules, fx_log, strings, activity_log
```

**What's done (Milestones 1-5):**
- ✅ Express skeleton + Knex + PostgreSQL connected
- ✅ All tables created with UUID PKs, workspace_id isolation, audit fields
- ✅ Google OAuth flow (Passport.js) — login redirects to Google, JWT issued on callback
- ✅ Auth middleware injects `req.user`, `workspace_id`, and `req.logger` from JWT
- ✅ Auto-workspace creation on first login (user gets one default workspace)
- ✅ Frontend login screen + token management (storage in httpOnly cookie, logout)
- ✅ Admin scripts for workspace/user management
- ✅ Properties API — full CRUD, workspace-scoped, auto-creates account on property creation
- ✅ Transactions API — full CRUD, workspace-scoped, with date/type/category validation

**What's next (Milestone 5.5+):**
- Logging & Telemetry Foundation (migrations 010-012, logger utility, retrofit existing APIs)
- Rules API (built with logging from day 1)
- Replace frontend's `sheets.js` with `api.js` calling backend
- Retire Google Sheets credential from frontend

**Backlog and epics:** See [`docs/epics/`](epics/00-index.md) for the full feature backlog organised by epic, including acceptance criteria, dependencies, and MVP vs future tags.

**What stays the same:**
- The transaction data model and category taxonomy (see data-model.md)
- The bank import profiles and column mapping system (client-side)
- All frontend UI logic not related to data persistence

---

## Migration path

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Static frontend + Google Sheets on Synology NAS | ✅ Done |
| 2 | Add backend/ with Node + Express + PostgreSQL | ✅ Done (M1-M3) |
| 3 | Add authentication (Google OAuth → JWT) | ✅ Done (M3) |
| 4 | Build API routes (properties, transactions) | ✅ Done (M4-M5) |
| 4.5 | Logging & Telemetry Foundation | 🔄 In progress (M5.5) |
| 5 | Rules API + logging from day 1 | ⏳ Pending (M6) |
| 6 | Replace sheets.js + data.js with api.js | ⏳ Pending (post-M6) |
| 7 | Retire Google Sheets credential, test e2e | ⏳ Pending (post-M6) |
| 8 | Optional: move to managed hosting / separate domain | ⏳ Future |

---

## v2 backend architecture

**Key decisions:**
- **Monolithic:** Express serves static frontend from the same process (no NAS, no CORS, one domain)
- **Query builder:** Knex.js for all database access (dialect-portable, migrations in `backend/src/db/migrations/`)
- **Multi-tenancy:** All data tables carry `workspace_id`; auth middleware injects it from JWT
  - Cross-workspace access is **structurally impossible** at the query level (no runtime checks needed)
- **Authentication:** Google OAuth 2.0 → JWT issued in httpOnly cookie (secure against XSS)
- **Audit trail:** All tables have `created_at`, `created_by`, `last_modified_at`, `last_modified_by`
  - Automatically stamped on INSERT/UPDATE, backend code sets the user ID from JWT
- **Structured logging:** All routes use `req.logger` (injected by auth middleware)
  - Writes to stdout and to the `activity_log` table
  - Log level configurable per workspace and per user, with automatic expiry back to global default
  - Global default: `error` (least verbose); levels: `error`, `info`, `debug`
  - See `docs/LOGGING.md` for full reference
- **Deployment:** No Docker required
  - Dev: `npm start` on laptop, port 3000
  - Prod: `pm2 start backend/src/index.js` on Linux server, port 3001

**Database schema** (see `docs/data-model.md` for full field reference):
- `workspaces` — portfolio containers; one per user (auto-created on first login)
- `users` — Google OAuth identities; one per email
- `workspace_users` — role assignment (owner, editor, viewer, member)
- `properties`, `transactions`, `rules`, `fx_log`, `strings` — all workspace-scoped

**Environment variables** (see `backend/.env.example`):
- `PORT` — Express listen port (default 3000)
- `FRONTEND_URL` — frontend domain for OAuth callback (e.g., `http://localhost:3000` for dev)
- `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://user:pass@localhost/landlordguru_dev`)
- `JWT_SECRET` — secret for signing JWTs (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from Google Cloud Console (see `docs/BACKEND-SETUP.md`)
- `SESSION_SECRET` — for express-session (generate with `openssl rand -base64 32`)

**Admin scripts** (in `backend/scripts/`):
- `create-workspace.js` — creates a new workspace (requires email)
- `assign-user-to-workspace.js` — adds an existing user to a workspace, or auto-creates them
- Run with `node backend/scripts/create-workspace.js` (interactive prompts)
