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

## Intended future state (v2 — proper web app)

```
Browser
  └── frontend/                   (React or vanilla JS, served by CDN or Node)
        ├── js/strings.js         (unchanged — i18n layer)
        ├── js/importer.js        (unchanged — pure CSV logic)
        ├── js/reports.js         (unchanged — pure aggregation logic)
        └── js/api-client.js      (replaces sheets.js + data.js)
              ↕  REST API (HTTPS)
backend/
  └── src/
        ├── routes/               properties, transactions, rules, reports
        ├── db/                   query functions
        └── middleware/           auth, validation
              ↕  SQL
PostgreSQL
  └── schema defined in migrations/
```

**What changes:**
- `sheets.js` is deleted — no longer talking to Google Sheets directly
- `data.js` is replaced by a thin `api-client.js` that calls the backend REST API
- `key.php` / `debug.inc.php` are retired — auth moves server-side
- `importer.js` stays in the frontend (CSV parsing is a client-side concern)
- `reports.js` stays in the frontend (pure functions, no I/O)
- Auth moves from a shared static credential to proper user accounts (you + wife)
- The Google Sheet can be retained as a read-only audit view via a sync job, or retired

**What stays the same:**
- The transaction data model and category taxonomy (see data-model.md)
- The bank import profiles and column mapping system
- The UI and all frontend logic not related to data persistence

---

## Migration path

| Phase | Description |
|-------|-------------|
| 1 (done) | Static frontend + Google Sheets. Deployed on Synology NAS. |
| 2 (active) | Add backend/ with Node + Express + PostgreSQL. Express serves frontend static files. |
| 3 | Replace sheets.js + data.js with api-client.js pointing to backend. |
| 4 | Add authentication (Google OAuth → JWT). Remove Google Sheets credential from frontend. |
| 5 | Optional: move to managed hosting / separate domain (www.landlordguru.com). |

---

## v2 backend (in progress)

```
Browser
  ↕  HTTPS (landlordguru.galant.info)
Linux server
  └── Express (backend/src/index.js)
        ├── express.static → frontend/     serves the full browser app
        └── /api/*                         REST API routes
              ↕  Knex.js
        PostgreSQL
              ├── workspaces
              ├── users
              ├── workspace_users
              ├── properties         (+ workspace_id)
              ├── transactions       (+ workspace_id)
              ├── rules              (+ workspace_id)
              ├── fx_log             (+ workspace_id)
              └── strings            (+ workspace_id)
```

**Key decisions:**
- Express serves the static frontend from the same process — no NAS, no CORS, one domain
- Knex.js for all DB access: query builder, dialect-portable (PostgreSQL today, swappable later)
- Migrations live in `backend/src/db/migrations/` — run with `npm run migrate`
- All data tables carry `workspace_id`; auth middleware injects it from the JWT so
  cross-workspace access is structurally impossible at the query level
- No Docker required — deployment is `git pull && npm install && pm2 reload`
- `config.js` is retired once Milestone 7 (cut-over) completes

**Environment variables** (see `backend/.env.example`):
- `PORT` — Express listen port (default 3000)
- `FRONTEND_URL` — allowed CORS origin
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — added in Milestone 3
