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
  ├── src/routes/
  │   ├── auth.js               GET /auth/google, /auth/google/callback, POST /logout
  │   ├── health.js             GET /api/health (for monitoring)
  │   ├── properties.js          GET/POST/PATCH/DELETE /api/properties (in progress)
  │   ├── transactions.js        GET/POST/PATCH/DELETE /api/transactions (todo)
  │   └── rules.js              GET/POST/PATCH/DELETE /api/rules (todo)
  ├── src/middleware/
  │   ├── auth.js               JWT verification, req.user + workspace_id injection
  │   └── errors.js             Error handler (todo)
  └── src/db/migrations/         Knex.js schema migrations (001-006, all created)
              ↕  PostgreSQL
        8 tables: workspaces, users, workspace_users, properties, transactions, rules, fx_log, strings
```

**What's done (Milestones 1-3):**
- ✅ Express skeleton + Knex + PostgreSQL connected
- ✅ All 8 tables created with UUID PKs, workspace_id isolation, audit fields
- ✅ Google OAuth flow (Passport.js) — login redirects to Google, JWT issued on callback
- ✅ Auth middleware injects `req.user` + `workspace_id` from JWT
- ✅ Auto-workspace creation on first login (user gets one default workspace)
- ✅ Frontend login screen + token management (storage in httpOnly cookie, logout)
- ✅ Admin scripts for workspace/user management

**What's next (Milestone 4+):**
- Properties API (GET/POST/PATCH/DELETE routes)
- Transactions API (+ batch CSV import endpoint)
- Rules + Reports API
- Replace frontend's `sheets.js` with `api.js` calling backend
- Retire Google Sheets credential from frontend

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
| 4 | Build API routes (properties, transactions, rules) | 🔄 In progress (M4) |
| 5 | Replace sheets.js + data.js with api.js | ⏳ Pending (post-M4) |
| 6 | Retire Google Sheets credential, test e2e | ⏳ Pending (post-M5) |
| 7 | Optional: move to managed hosting / separate domain | ⏳ Future |

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
