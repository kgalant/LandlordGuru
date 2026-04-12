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
| 1 (now) | Static frontend + Google Sheets. Deployed on Synology NAS. |
| 2 | Add backend/ with Node + Express. Define schema in migrations/. Import Google Sheet data. |
| 3 | Replace sheets.js + data.js with api-client.js pointing to backend. |
| 4 | Add authentication (JWT or session). Remove credential from frontend entirely. |
| 5 | Optional: containerise with Docker, deploy to VPS or cloud. |

Phase 2 is the natural next step once the data model has stabilised through real use.
