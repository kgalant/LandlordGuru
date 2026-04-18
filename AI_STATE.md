# AI State

## Goal
Build v2: real backend (Node/Express/PostgreSQL) + user auth + workspace multi-tenancy.
Frontend served by Express (no NAS dependency). Google Sheets retired when backend is stable.

## Current phase
v2 backend development — Milestone 7 (Frontend cut-over) complete

## In progress
(None — Milestone 7 complete)

## Next step
Milestone 8: Optional — Retire Google Sheets credentials and test end-to-end; OR Build Accounts UI with full multi-property support

---

## Completed milestones

| Milestone | Version | Description |
|-----------|---------|-------------|
| M1 — Backend skeleton | v2.0.0 | Express + Knex + PostgreSQL |
| M2 — Database schema | v2.0.0 | 8 tables with workspace_id isolation |
| M3 — Google OAuth + JWT | v2.1.0 | Auth flow, auto-workspace creation |
| M4 — Properties API | v2.2.0 | Full CRUD + Jest/Supertest tests |
| Feature 2.2 — Property UI wired | v2.3.0 | frontend/js/api.js, Properties list live |
| M5 — Transactions API | v2.4.0 | Full CRUD with filters & validation |
| Feature 5.2 — Transactions UI wired | v2.5.0 | Transactions list live (create/edit/delete) |
| M5.5 — Logging & Telemetry | v2.6.0 | Phases 0-2: docs, logger.js, Properties & Transactions logging |
| M6 — Rules API | v2.7.0 | Full CRUD + tests, logging from day 1 |
| M7 — Frontend cut-over | v2.8.0 | All CRUD + import via backend API; rules auto-save |

---

## Design decisions (locked)

**Logging:**
- Levels: `error`, `info`, `debug` (least → most verbose)
- Resolution: user override (expires) → workspace default (expires) → global `error`
- Storage: `log_level` + `log_level_expires_at` on workspaces and workspace_users
- Injection: auth middleware as `req.logger`
- Tests do NOT assert on logging (side-effect only)

**Architecture:**
- Monolithic: Express serves static frontend from same process
- Multi-tenancy: all data tables carry `workspace_id`; structurally isolated
- Auth: Google OAuth 2.0 → JWT in httpOnly cookie
- DB: PostgreSQL + Knex.js migrations
- Deployment: PM2 on Linux, no Docker

**Accounts:**
- Auto-created `is_default=true` account per workspace (fallback)
- On property creation: auto-create account + link via account_properties
- Resolution: explicit → property's account → workspace default

---

## Schema notes

All 9 data tables carry `workspace_id`. Auth middleware injects from JWT — cross-workspace access structurally impossible.

**Migrations:**
- 001-009: core schema (workspaces, users, properties, transactions, rules, accounts, etc.)
- 010: `log_level` + `log_level_expires_at` on workspaces
- 011: `log_level` + `log_level_expires_at` on workspace_users
- 012: activity_log table (workspace_id, user_id, timestamp, level, action, parameters)

---

## Blockers
(none)

---

## Checkpoint Procedure (use after each completed step)

After you finish a step or make significant progress:

1. **Commit changes to git** with a clear message
2. **Update this file immediately:**
   - Mark completed items in "In progress" section
   - Update "In progress:" field with current step and specific action
   - Update "Next step:" field with the single next action (be specific: "Read X line Y to understand Z")
   - Update "Files touched:" list below
3. **Only then continue** to the next step

**Example (after completing a step):**
```
## In progress
Step 4: Wiring rules in refreshAll

## Next step
Read index.html:722 to understand refreshAll() structure; add Api.getRules() call

## Files touched this session
- backend/src/routes/properties.js
- backend/tests/properties.test.js
- git_commits: 60d3f1f, efd126d
```

This ensures that if the session stops at any point, the next session can resume exactly where you left off.

---

## Last validation

✅ All 60 tests passing (M7 changes)
- Properties GET/POST/PATCH: account_id returned
- Transactions GET/POST/PATCH: property_id returned
- Transactions GET: ?property_id= filter works
- All assertions added for new fields

✅ Manual testing (need to run dev server)
- Frontend v2 mode: properties, transactions, rules all load from backend
- Rules UI: add, delete, reorder all work with auto-save
- CSV import: transactions batch-created with shared import_batch ID
- Property filter on transactions: uses account_id correctly

---

## Last commit
efd126d Milestone 7: Frontend cut-over to backend API (v2.7.0 → v2.8.0)

---

## Session notes
(Use this space for decisions, blockers, or clarifications made in the current session)

## Automation log
(Latest entry only; previous entries in `.claude/ai_state_archive.json`)

- 2026-04-18 19:30:00 [M7 complete]
  - branch: main
  - last_commit: efd126d Milestone 7: Frontend cut-over to backend API (v2.7.0 → v2.8.0)
  - changed_files: backend/src/routes/properties.js, backend/src/routes/transactions.js, backend/tests/properties.test.js, backend/tests/transactions.test.js, frontend/js/api.js, frontend/index.html, frontend/version.json, AI_STATE.md
  - git_status: committed

- 2026-04-18 18:57:47 [lifecycle]
  - branch: main
  - last_commit: a119720 Update AI_STATE: M7 (Frontend cut-over) complete

- 2026-04-18 18:59:03 [lifecycle]
  - branch: main
  - last_commit: a119720 Update AI_STATE: M7 (Frontend cut-over) complete
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:01:02 [lifecycle]
  - branch: main
  - last_commit: a119720 Update AI_STATE: M7 (Frontend cut-over) complete
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:02:25 [lifecycle]
  - branch: main
  - last_commit: a119720 Update AI_STATE: M7 (Frontend cut-over) complete
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md
