# AI State

## Goal
Build v2: real backend (Node/Express/PostgreSQL) + user auth + workspace multi-tenancy.
Frontend served by Express (no NAS dependency). Google Sheets retired when backend is stable.

## Current phase
M9 — E2E Testing & Bug Fixes (found 4 issues during browser testing on server)

## Pending work
- [ ] Issue 4: Fix sync error showing next to refresh and sign out buttons

## In progress
- Issue 4: Fix sync error showing next to refresh and sign out buttons
  - Root cause: refreshAll() is throwing an error when calling the backend API
  - Location: refreshAll() line 727-730 catches API errors and calls setStatus('status.syncError')
  - Likely triggers:
    1. JWT token is expired or invalid (401 error from backend)
    2. Backend API endpoint returning an error (500, etc)
    3. Network issue or CORS blocking the request
  - Next step: Test locally with npm start and check browser console for the actual error being thrown by Promise.all([Api.getProperties(), Api.getTransactions(), Api.getRules()])

## Completed (this session)
- ✅ Issue 1: CATEGORIES not defined (commit 47293a2)
- ✅ Issue 3: Add 'Add your first property' button on dashboard when no properties exist (modified index.html renderDashboard function)

### M8 Completed:
✅ 1. Remove v1 code paths: stripped sheets.js, data.js, and all !AUTH_TOKEN fallbacks from frontend
✅ 2. Remove Google Sheets config from config.example.js
✅ 3. Remove !AUTH_TOKEN conditionals throughout index.html (9 functions updated)
✅ 4. Test dev server: npm start boots cleanly, database connects
✅ 5. Verify no broken references: npm test 60/60 passing
✅ 6. Version: v2.8.0 → v2.9.0 (cleanup release, commit 37d1c30)
⏳ 7. Manual e2e test: login + CRUD — pending browser testing (no code changes needed)

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
| M8 — Retire v1 code | v2.9.0 | Removed sheets.js, data.js, all !AUTH_TOKEN fallbacks, Google Sheets config |

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

✅ All 60 tests passing (M8 changes)
- No broken references from v1 code removal
- All backend API tests still pass

✅ App boot test
- npm start: cleanly boots, no v1 code references
- Database connects successfully
- Frontend served by Express

⏳ Manual e2e testing pending
- Login via Google OAuth, verify CRUD operations work
- (Can be done in browser without impacting code)

---

## Last commit
37d1c30 Milestone 8: Retire Google Sheets credentials and v1 code paths (v2.8.0 → v2.9.0)

---

## Files touched this session
- frontend/index.html (removed sheets.js + data.js script tags; removed all !AUTH_TOKEN fallback paths from boot, refreshAll, saveTx, deleteTxModal, processImportFile, savePropertyModal, deleteRule, saveRuleModal, saveRules)
- frontend/config.example.js (removed all Google Sheets config; kept only BANK_PROFILES, CATEGORIES, FX_RATES display config)
- frontend/js/sheets.js (DELETED)
- frontend/js/data.js (DELETED)
- frontend/version.json (v2.8.0 → v2.9.0)

## Session notes
✅ npm test: 60/60 tests passing (no broken references from v1 code removal)
- Confirmed all v1 fallback paths successfully removed from index.html
- sheets.js and data.js deleted
- config.example.js now v2-only

✅ App boot test: npm start succeeds cleanly
- No references to sheets.js, data.js, Google Sheets config
- Database connects successfully
- Frontend served by Express on port 3000
- Ready for manual e2e in browser (login → CRUD)

## Automation log
(Latest entry only; previous entries in `.claude/ai_state_archive.json`)

- 2026-04-18 21:45:00 [M8 complete — v1 code retirement]
  - branch: main
  - last_commit: 37d1c30 Milestone 8: Retire Google Sheets credentials and v1 code paths (v2.8.0 → v2.9.0)
  - changed_files: frontend/index.html, frontend/config.example.js, frontend/version.json, frontend/js/sheets.js (deleted), frontend/js/data.js (deleted), AI_STATE.md
  - session_work: M8 complete (removed sheets.js, data.js, all !AUTH_TOKEN fallbacks, Google Sheets config); 60/60 tests passing; app boots cleanly
  - git_status: committed; M8 complete, manual e2e testing pending (browser-only)

- 2026-04-18 19:04:09 [lifecycle]
  - branch: main
  - last_commit: 21b5bc5 Prepare M8: document scope and stopping point for next session

- 2026-04-18 19:06:31 [lifecycle]
  - branch: main
  - last_commit: 21b5bc5 Prepare M8: document scope and stopping point for next session
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:12:35 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented

- 2026-04-18 19:13:16 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:15:03 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:15:41 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:16:39 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:18:00 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:20:06 [lifecycle]
  - branch: main
  - last_commit: b4f3d98 Update AI_STATE.md: M8 complete, scope fully documented
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:26:30 [lifecycle]
  - branch: main
  - last_commit: 47293a2 Fix CATEGORIES not defined: check config.js into git (no secrets in v2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md

- 2026-04-18 19:28:38 [lifecycle]
  - branch: main
  - last_commit: 47293a2 Fix CATEGORIES not defined: check config.js into git (no secrets in v2)
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md
