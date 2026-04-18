# AI State

## Goal
Build v2: real backend (Node/Express/PostgreSQL) + user auth + workspace multi-tenancy.
Frontend served by Express (no NAS dependency). Google Sheets retired when backend is stable.

## Current phase
v2 backend development — Milestone 6 (Rules API) complete

## In progress
(None — Milestone 6 complete)

## Next step
Milestone 7: Replace frontend's `sheets.js` with `api.js` calling backend (frontend cut-over)

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

## Last validation

✅ All 60 tests passing
- Rules API: POST, GET, PATCH, DELETE (24 new tests)
- Properties API: 13 tests
- Transactions API: 23 tests
✅ Category validation: all 15 categories tested
✅ Workspace isolation: verified cross-workspace access returns 404

---

## Last commit
(Update on Milestone 7 start)

---

## Session notes
(Use this space for decisions, blockers, or clarifications made in the current session)

## Automation log
(Latest entry only; previous entries in `.claude/ai_state_archive.json`)

- 2026-04-18 17:41:25 [lifecycle]
  - branch: main
  - last_commit: fa18b0f Milestone 6: Rules API with logging from day 1 (v2.6.0 → v2.7.0)
  - changed_files: AI_STATE.md
  - git_status: M AI_STATE.md

- 2026-04-18 18:22:59 [lifecycle]
  - branch: main
  - last_commit: fa18b0f Milestone 6: Rules API with logging from day 1 (v2.6.0 ΓåÆ v2.7.0)
  - changed_files: AI_STATE.md, CLAUDE.md
  - git_status:
     M AI_STATE.md
     M CLAUDE.md
    ?? .claude/ai_state_archive.json

- 2026-04-18 18:24:03 [lifecycle]
  - branch: main
  - last_commit: 75e409c Slim down AI_STATE.md and establish automation log policy

- 2026-04-18 18:25:32 [lifecycle]
  - branch: main
  - last_commit: 75e409c Slim down AI_STATE.md and establish automation log policy
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 18:27:40 [lifecycle]
  - branch: main
  - last_commit: 75e409c Slim down AI_STATE.md and establish automation log policy
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 18:29:47 [lifecycle]
  - branch: main
  - last_commit: 8265242 Fix logger DB access: register db on app before starting server
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md
