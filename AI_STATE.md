# AI State

## Goal
Build v2: real backend (Node/Express/PostgreSQL) + user auth + workspace multi-tenancy.
Frontend served by Express (no NAS dependency). Google Sheets retired when backend is stable.

## Current phase
Planning complete — waiting for laptop setup before starting Milestone 1.

## Completed
### Bug fixes (v1.3.x)
- Fixed `#import-preview-header` showing as a tiny sliver
- Fixed `#import-preview-header` scrolling offscreen: `top: 52px` for nav bar
- Fixed `select-same-desc-toggle` not resetting after firing
- Fixed `thead` not sticking: contained scroll area (`#import-table-scroll`)
- Fixed `#import-static-header` (Review — ready to import) scrolling offscreen (1.3.1 → 1.3.2)

### v2 Architecture decisions
- **Server:** spare laptop running Linux (dev + prod on same machine)
- **Database:** PostgreSQL; Knex.js as query builder/migration runner
- **Backend:** Node.js + Express
- **Auth:** Google OAuth 2.0 → JWT (passport + passport-google-oauth20)
- **Frontend hosting:** served by Express (`express.static`) — same process, same domain, no CORS
- **No Docker requirement:** portability via env vars + git pull + pm2 reload
- **Domain (now):** landlordguru.galant.info — CNAME in one.com DNS panel
- **Domain (future):** www.landlordguru.com — same server, update OAuth callback + FRONTEND_URL env var
- **Dev:** VS Code Remote SSH into laptop, port 3000 + `landlordguru_dev` DB
- **Prod:** PM2 on port 3001 + `landlordguru_prod` DB; Cloudflare Tunnel or direct DNS
- **Deployment:** git pull + pm2 reload (optionally via GitHub webhook)
- **NAS:** retired from this app once backend is live

## In progress
- Milestone 1 — backend skeleton (files written, pending npm install + verification on laptop)

## Next step
On the laptop: cd backend && npm install, copy .env.example to .env, set DATABASE_URL, run node src/index.js, verify /api/health and static serving.

## Milestone plan (v2)
```
Milestone 1   Backend skeleton
              Express app, Knex connected to PostgreSQL,
              health-check endpoint, running on laptop

Milestone 2   Schema
              Migrations: workspaces, users, workspace_users,
              properties, transactions, rules, fx_log, strings
              (all data tables get workspace_id)

Milestone 3   Auth
              Google OAuth, JWT issued, frontend login screen

Milestone 4   Properties API
              CRUD endpoints, workspace-scoped

Milestone 5   Transactions API
              CRUD + batch import endpoint

Milestone 6   Rules + Reports API

Milestone 7   Cut over
              api.js replaces sheets.js, Google Sheets retired
```

## Schema notes
All existing tables get `workspace_id`.
New tables: `workspaces`, `users`, `workspace_users` (role + permissions JSON, null for now).
Auth middleware injects `workspace_id` from JWT — cross-workspace access structurally impossible.

## Blockers
- Laptop not yet set up with Linux

## Resume prompt
Read this file. Laptop should now have Linux, Node.js, PostgreSQL, and PM2 installed.
Confirm those are in place, then begin Milestone 1: backend skeleton.

## Automation log

- 2026-04-13 20:10:01 [lifecycle]
  - branch: main
  - last_commit: 0f13b27 Fix import preview sticky headers ΓÇö contained scroll area (1.3.0 ΓåÆ 1.3.1)
  - changed_files: .claude/settings.json, AI_STATE.md, CLAUDE.md, frontend/css/style.css, frontend/index.html, frontend/version.json
  - git_status:
     M .claude/settings.json
     M AI_STATE.md
     M CLAUDE.md
     M frontend/css/style.css
     M frontend/index.html
     M frontend/version.json

- 2026-04-13 20:24:39 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)

- 2026-04-13 20:30:35 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:33:05 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:33:51 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:35:34 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:38:48 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:43:55 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:49:03 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:52:08 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:54:14 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:55:50 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-13 20:57:57 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:23:43 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:25:15 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:27:24 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:30:41 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:31:52 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:32:12 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:34:22 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:34:55 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:36:06 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/

- 2026-04-15 14:36:44 [lifecycle]
  - branch: main
  - last_commit: f786042 Fix sticky header on Review ready-to-import screen (1.3.1 ΓåÆ 1.3.2)
  - changed_files: AI_STATE.md, docs/ARCHITECTURE.md
  - git_status:
     M AI_STATE.md
     M docs/ARCHITECTURE.md
    ?? backend/.env.example
    ?? backend/package.json
    ?? backend/src/
