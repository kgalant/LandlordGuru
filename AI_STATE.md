# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-4
- Title: Bulk CSV import endpoint
- Short summary: Done — smoke-tested and committed as 42adc6b.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F3-4-1: Backend — add `POST /api/transactions/import`; validate all rows, generate UUID, atomic insert, return `{ inserted, import_batch }`; add tests
- [x] F3-4-2: Frontend — replace `Api.createTransactionBatch` loop with single call to new endpoint; update response handling
- [x] F3-4-3: Smoke-test full flow; update epic doc status to Done; commit

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F1-12, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11, F5-13 (polish/UX, low priority)
- Next MVP candidates: F3-5 (import batch rollback), F5-12 (duplicate detection), F2-6, F2-7
- Frontend architecture: F7-1 through F7-5 (DataTable component + migrations) — Done

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md`      (E3)
- `docs/epics/04-reporting-analytics.md`         (E4)
- `docs/epics/05-integrations-data-import.md`    (E5)
- `docs/epics/06-architecture-backend.md`        (E6)
- `docs/epics/07-frontend-architecture.md`       (E7)

---

## Next step

Select next focus. MVP candidates: F3-5 (import batch rollback), F5-12 (duplicate detection), F2-6 (account hierarchy UI), F2-7 (account linked-items view).

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-01 14:10:00
  - Outcome: 205/205 tests passing. F3-4 complete and smoke-tested.

---

## Files touched this session

- `AI_STATE.md`
- `.claude/ai_state_archive.json`
- `backend/src/routes/transactions.js`
- `backend/tests/transactions.test.js`
- `frontend/js/api.js`
- `frontend/js/app.js`
- `version.json`
- `docs/epics/03-transaction-management.md`
- `docs/epics/05-integrations-data-import.md`

---

## Automation log (latest only)

- 2026-05-01 14:45:00 F3-4 done — smoke-tested, epic doc updated
  - branch: main
  - last_commit: 42adc6b
  - changed_files: docs/epics/03-transaction-management.md, AI_STATE.md, .claude/ai_state_archive.json
  - git_status: M .claude/settings.json, M AI_STATE.md, M docs/epics/03-transaction-management.md, ?? .claude/hooks/checkpoint.sh
