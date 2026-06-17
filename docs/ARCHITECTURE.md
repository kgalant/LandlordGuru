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

## Current state (v2 — shipped)

```
Browser
  └── frontend/                       (vanilla JS, no build step; served by Express)
        ├── js/app.js                 Main UI logic, event handlers, page state (~3,900 LOC)
        ├── js/datatable.js           Table rendering, sorting, filtering, pagination
        ├── js/api.js                 REST client wrapper for /api/* routes
        ├── js/importer.js            CSV parsing, bank format auto-detection, categorization
        ├── js/reports.js             P&L calculations and aggregations
        ├── js/auth.js                Google OAuth login, JWT token management, logout
        ├── js/strings.js             UI text constants and label overrides
        ├── js/version-badge.js       Version display widget + debug panel
        └── js/debug.js               Development utilities
              ↕  HTTPS (landlordguru.galant.info)
backend/ (Node.js + Express)
  ├── src/index.js                Express app, session + passport setup, static frontend serving
  ├── src/lib/
  │   └── logger.js               Structured logger — injected as req.logger by auth middleware
  ├── src/routes/
  │   ├── auth.js                 GET /auth/google, /auth/google/callback, POST /logout
  │   ├── properties.js           GET/POST/PATCH/DELETE /api/properties
  │   ├── transactions.js         GET/POST/PATCH/DELETE /api/transactions (incl. split management)
  │   ├── rules.js                GET/POST/PATCH/DELETE /api/rules (property-scoped)
  │   ├── split-rules.js          GET/POST/PATCH/DELETE /api/split-rules
  │   ├── accounts.js             GET/POST/PATCH/DELETE /api/accounts (hierarchy)
  │   ├── workspace.js            GET/PATCH /api/workspace (settings, users, roles)
  │   ├── currency-rates.js       GET/PATCH /api/currency-rates
  │   ├── reports.js              GET /api/reports (P&L, category breakdown, transfers)
  │   └── version.js              GET /api/version (health + version info)
  ├── src/middleware/
  │   ├── auth.js                 JWT verification; injects req.user, workspace_id, req.logger
  │   └── telemetry.js            Request telemetry
  └── src/db/migrations/          Knex.js schema migrations (001–025)
              ↕  PostgreSQL
        Core: workspaces, users, workspace_users
        Data: properties, accounts, transactions, transaction_splits
        Rules: rules, split_rules
        Reference: fx_log, currency_rates, strings, workspace_enum_values
        Audit: activity_log, workspace_settings
```

**Backlog and epics:** See [`docs/epics/`](epics/00-index.md) for the full feature backlog organised by epic, including acceptance criteria, dependencies, and status.

---

## Migration path

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Static frontend + Google Sheets on Synology NAS | ✅ Done |
| 2 | Add backend/ with Node + Express + PostgreSQL | ✅ Done |
| 3 | Add authentication (Google OAuth → JWT) | ✅ Done |
| 4 | Build API routes (properties, transactions) | ✅ Done |
| 4.5 | Logging & Telemetry Foundation | ✅ Done |
| 5 | Rules API + logging from day 1 | ✅ Done |
| 6 | Replace sheets.js + data.js with api.js | ✅ Done |
| 7 | Retire Google Sheets credential, test e2e | ✅ Done |
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
  - Dev: `npm run start:local` on laptop, port 3000 (opens SSH tunnel + starts server)
  - Test: PM2 process `landlordguru-test` on homedev, port 3001
  - Prod: PM2 process `landlordguru` on homedev, port 3002

**Database schema** (25 migrations; see `docs/data-model.md` for full field reference):
- `workspaces`, `users`, `workspace_users` — auth and multi-tenancy
- `properties`, `accounts` — portfolio structure; accounts form a parent-child hierarchy
- `transactions`, `transaction_splits` — core ledger; splits link to a parent transaction
- `rules` — property-scoped auto-categorization; `split_rules` — automated split templates
- `currency_rates`, `fx_log` — exchange rates, workspace-scoped
- `strings`, `workspace_enum_values` — workspace-level label overrides
- `activity_log`, `workspace_settings` — audit trail and per-workspace configuration

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
