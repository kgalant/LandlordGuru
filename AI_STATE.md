# AI State

## Goal
Build v2: real backend (Node/Express/PostgreSQL) + user auth + workspace multi-tenancy.
Frontend served by Express (no NAS dependency). Google Sheets retired when backend is stable.

## Current phase
v2 backend development — Milestone 3 (Google OAuth + JWT authentication)

## Completed
### Bug fixes (v1.3.x)
- Fixed `#import-preview-header` showing as a tiny sliver
- Fixed `#import-preview-header` scrolling offscreen: `top: 52px` for nav bar
- Fixed `select-same-desc-toggle` not resetting after firing
- Fixed `thead` not sticking: contained scroll area (`#import-table-scroll`)
- Fixed `#import-static-header` (Review — ready to import) scrolling offscreen (1.3.1 → 1.3.2)

### v2 Milestone 1 — Backend skeleton ✅
- Express app serving static frontend from backend/src/index.js
- Knex.js connected to PostgreSQL (with .pgpass for local dev)
- `/api/health` endpoint working
- Frontend loads and displays correctly at http://localhost:3000
- All files committed to GitHub, laptop clone working

### v2 Milestone 2 — Schema & Migrations ✅
- 6 Knex migration files: 001_auth_tables through 006_strings
- All 8 tables: workspaces, users, workspace_users, properties, transactions, rules, fx_log, strings
- All data tables carry workspace_id for isolation
- Auto-migration on startup: db.migrate.latest() runs before app.listen()
- knexfile.js for Knex CLI
- Idempotent migrations: safe for dev, prod, fresh databases
- Tested on laptop: migration rollback + re-run successful

### Pre-M3 — Audit Fields ✅
- Updated all 6 migrations: renamed `updated_at`/`updated_by` → `last_modified_at`/`last_modified_by`
- All timestamps now have DEFAULT now() — data always stamped on creation
- On INSERT: app code must set both `created_by` and `last_modified_by` to authenticated user
- On UPDATE: app code explicitly sets `last_modified_at` and `last_modified_by`
- Verified in database: psql shows all columns correctly

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
-

## Next step
Milestone 3: Google OAuth + JWT authentication
1. Add passport dependencies to backend/package.json
2. Create backend/src/routes/auth.js — OAuth flow, JWT issuance, workspace auto-create
3. Create backend/src/middleware/auth.js — JWT verification, req.user injection
4. Update backend/src/index.js — wire up session + passport + auth routes
5. Update backend/.env.example — add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, GOOGLE_CALLBACK_URL
6. Add login screen to frontend (centered, sign-in-with-google button)
7. Add auth init script to frontend (token storage, expiry check, logout)

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
-

## Validation (last run)
Laptop: `cd ~/dev/landlordguru/backend && npm run migrate:rollback -- --all && npm run migrate && (pkill -f "node src/index.js" || true) && sleep 1 && npm start & sleep 5 && curl http://localhost:3000/api/health`
Result: ✅ `{"status":"ok"}` returned; psql confirmed all tables exist with UUID PKs and audit fields

## Files touched this session
- backend/src/db/migrations/001_auth_tables.js (renamed updated_* to last_modified_*, set defaults)
- backend/src/db/migrations/002_properties.js (same)
- backend/src/db/migrations/003_transactions.js (same)
- backend/src/db/migrations/004_rules.js (same)
- backend/src/db/migrations/005_fx_log.js (same)
- backend/src/db/migrations/006_strings.js (same)

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

- 2026-04-15 14:39:32 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)

- 2026-04-15 14:45:02 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:47:27 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:49:17 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:49:50 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:50:53 [lifecycle]
  - branch: main
  - last_commit: 989064a Milestone 1: backend skeleton ΓÇö Express + Knex + static frontend serving (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 14:54:38 [lifecycle]
  - branch: main
  - last_commit: 37d48bd Update AI_STATE: Milestone 1 complete and verified

- 2026-04-15 14:57:32 [lifecycle]
  - branch: main
  - last_commit: 03c4c0e Milestone 2: database schema and migrations ΓÇö 8 tables with workspace_id isolation (v2.0.0)

- 2026-04-15 14:58:53 [lifecycle]
  - branch: main
  - last_commit: 03c4c0e Milestone 2: database schema and migrations ΓÇö 8 tables with workspace_id isolation (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:01:45 [lifecycle]
  - branch: main
  - last_commit: 03c4c0e Milestone 2: database schema and migrations ΓÇö 8 tables with workspace_id isolation (v2.0.0)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:08:22 [lifecycle]
  - branch: main
  - last_commit: 7ae11c8 Milestone 2 verified on laptop: all 8 tables created

- 2026-04-15 15:15:32 [lifecycle]
  - branch: main
  - last_commit: 9261b10 Pre-M3: add UUID PKs and audit fields (created_at, created_by, updated_at, updated_by) to all tables
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:15:55 [lifecycle]
  - branch: main
  - last_commit: 9261b10 Pre-M3: add UUID PKs and audit fields (created_at, created_by, updated_at, updated_by) to all tables
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:16:32 [lifecycle]
  - branch: main
  - last_commit: 9261b10 Pre-M3: add UUID PKs and audit fields (created_at, created_by, updated_at, updated_by) to all tables
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:16:33 [lifecycle]
  - branch: main
  - last_commit: 9261b10 Pre-M3: add UUID PKs and audit fields (created_at, created_by, updated_at, updated_by) to all tables
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:17:31 [lifecycle]
  - branch: main
  - last_commit: 9261b10 Pre-M3: add UUID PKs and audit fields (created_at, created_by, updated_at, updated_by) to all tables
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:23:11 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:25:51 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:30:43 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:31:07 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:32:04 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:32:33 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:33:29 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:33:47 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:35:12 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:35:42 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:39:59 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:44:20 [lifecycle]
  - branch: main
  - last_commit: 4ff3cda Rename updated_* to last_modified_* and set defaults ΓÇö ensures audit trail always populated on create
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:47:17 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:50:42 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:51:45 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 15:53:51 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 16:06:53 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 16:06:54 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 16:11:57 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-15 16:14:57 [lifecycle]
  - branch: main
  - last_commit: 8c104ce Add primary_workspace_id to users table
  - changed_files: AI_STATE.md, backend/.env.example, backend/package.json, backend/src/index.js, frontend/css/style.css, frontend/index.html
  - git_status:
     M AI_STATE.md
     M backend/.env.example
     M backend/package.json
     M backend/src/index.js
     M frontend/css/style.css
     M frontend/index.html
    ?? backend/src/middleware/
    ?? backend/src/routes/
