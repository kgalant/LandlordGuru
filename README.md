# LandlordGuru

A web application for tracking rental income and expenses across a portfolio of apartments.

Currently manages four units — two long-term rentals in Denmark (DKK) and two short-term rentals in Poland (PLN).

## Architecture

```
Browser (any device)
    ↕  HTTPS
homedev  (nginx reverse proxy → landlordguru.galant.info)
    ↕
Node.js / Express  (serves frontend + REST API, port 3002)
    ↕
PostgreSQL  (landlordguru_prod on homedev)
```

Google is used only for login (OAuth2). All data lives in PostgreSQL.

## Features

- Dashboard with portfolio metrics and per-property summaries
- Transaction ledger with filtering by property, category, date range, and free-text search
- CSV import with auto-detection of bank format and column mapping
- Auto-categorisation rules scoped per property, applied at import time
- Manual transaction entry with full category taxonomy
- Split transactions
- P&L and category breakdown reports, transfers by property
- Notes field on every transaction

## Folder structure

```
landlordguru/
├── backend/                Node.js / Express API
│   ├── src/
│   │   ├── app.js          Express setup, middleware, route registration
│   │   ├── index.js        Server entry point (port, DB connect, migrate)
│   │   ├── db/             Knex connection + migrations
│   │   ├── routes/         REST endpoints (properties, transactions, rules, auth, …)
│   │   ├── lib/            Shared utilities (logger, …)
│   │   └── middleware/     Auth, workspace, request logging
│   ├── tests/              Jest + Supertest integration tests
│   ├── .env.example        Environment variable template
│   └── package.json
├── frontend/               Browser app (static HTML / CSS / JS, no build step)
│   ├── index.html
│   ├── js/
│   │   ├── app.js          UI logic and event handling
│   │   ├── api.js          REST client
│   │   ├── importer.js     CSV parser + auto-categorisation
│   │   ├── reports.js      Filtering, aggregation, P&L
│   │   └── strings.js      UI string constants
│   └── css/style.css
├── migrations/             Legacy (v1) — DB migrations now live in backend/src/db/migrations
├── scripts/                Deploy and tunnel helper scripts
├── docs/
│   ├── SETUP.md            Architecture overview + link to full guide
│   ├── BACKEND-SETUP.md    Full local dev + deployment guide
│   ├── ARCHITECTURE.md     Architecture history and decisions
│   ├── data-model.md       Transaction taxonomy and field definitions
│   ├── roadmap.md          Feature roadmap and MVP ordering
│   └── epics/              Per-epic feature specs
├── deploy-prod.sh          Deploy to production on homedev
├── deploy-test.sh          Deploy to test server on homedev
└── version.json            App version (bumped on every feature release)
```

## Setup

See [docs/BACKEND-SETUP.md](docs/BACKEND-SETUP.md) for full instructions.

Short version:
1. Clone repo, run `cd backend && npm install`
2. Copy `backend/.env.example` → `backend/.env` and fill in secrets
3. Open SSH tunnel: `bash scripts/tunnel.sh`
4. Run migrations: `cd backend && npm run migrate`
5. Start server: `npm run start:local`
6. Open `http://localhost:3000`
