# Rental Portfolio

A small web application for tracking rental income and expenses across a portfolio of apartments.

Currently manages four units — two long-term rentals in Denmark (DKK) and two short-term rentals in Poland (PLN).

## Current architecture

```
Browser (any device, anywhere)
    ↕  HTTPS
Synology NAS  —  serves frontend/ as static files via Web Station
    ↕  Google Sheets API (HTTPS)
Google Sheet  —  stores all data (apartments, transactions, rules)
```

No server-side code. No build step. Drop the `frontend/` folder onto the NAS and open `index.html`.

## Features

- Dashboard with portfolio metrics and per-apartment summaries
- Transaction ledger with filtering by apartment, category, date range, and free-text search
- CSV import with bank-specific profiles (Jyske Bank DK, Nordea DK, mBank PL, generic)
- Auto-categorisation rules applied at import time
- Manual transaction entry with full category taxonomy
- P&L and category breakdown reports
- Notes field on every transaction; required for "other expense"

## Folder structure

```
rental-portfolio/
├── frontend/               Browser app (static HTML/CSS/JS)
│   ├── index.html          Main application
│   ├── config.js           Credentials — gitignored, copy from config.example.js
│   ├── config.example.js   Template — safe to commit
│   ├── css/style.css
│   └── js/
│       ├── sheets.js       Google Sheets API auth and CRUD
│       ├── data.js         Data layer (apartments, transactions, rules)
│       ├── importer.js     CSV parser — bank profiles + auto-categorisation
│       └── reports.js      Filtering, aggregation, P&L
├── backend/                Empty — scaffolded for future migration
├── migrations/             Empty — will hold DB schema migrations
└── docs/
    ├── SETUP.md            NAS + Google Sheets setup guide
    ├── ARCHITECTURE.md     Current architecture and migration plan
    └── data-model.md       Transaction taxonomy and field definitions
```

## Setup

See [docs/SETUP.md](docs/SETUP.md) for full instructions.

Short version:
1. Create a Google Sheet and note the spreadsheet ID
2. Create a Google Cloud service account, download the JSON key
3. Share the sheet with the service account email (Editor)
4. Copy `frontend/config.example.js` → `frontend/config.js` and fill in credentials
5. Upload `frontend/` to `web/rental/` on the Synology NAS
6. Open `http://YOUR-NAS-IP/rental/`

## Planned migration

The intent is to migrate to a proper web application architecture with:
- Node.js / Express (or similar) backend
- PostgreSQL database (schema will be driven by `migrations/`)
- REST or GraphQL API replacing the direct Google Sheets calls in `data.js`
- `importer.js` and `reports.js` are pure logic and will move to the frontend unchanged
- `sheets.js` and `data.js` will be replaced by an API client

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for more detail.
