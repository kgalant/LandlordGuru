# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E7 Frontend Architecture
- ID: F7-3
- Title: Migrate rules table to DataTable
- Short summary: Replace the hand-rolled rules table in `app.js` with a `DataTable.create()` call. No filter bar, no pagination, no bulk ops — simpler than F7-2. Validates DataTable is not over-fitted to the transactions use case.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F7-3-1: Audit rules table in `app.js` and `index.html` — list symbols and HTML to replace
- [x] F7-3-2: Add `<div id="rules-table-wrap">` to `index.html`; remove static rules table markup
- [x] F7-3-3: Wire `DataTable.create()` in `app.js` — columns, `fetchData`, `renderRow`, no filter/pagination/bulk
- [x] F7-3-4: Delete dead code from `app.js`
- [-] F7-3-5: Smoke-test on homedev — rules render, delete works, no regressions

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: B2-1-1, B3-1-1 (referenced in backlog but not yet documented in epic docs — investigate before picking up), F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F1-12, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)
- Next MVP candidates (Wave 3): F2-2, F2-6, F2-7
- Frontend architecture: F7-1 through F7-5 (DataTable component + migrations)

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

F7-3-5: Deploy to homedev and smoke-test — rules page renders, add rule works, delete rule works, no regressions on transactions or other pages.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-28 09:00:00
  - Outcome: 161/161 tests passing. F7-2 smoke-tested and confirmed Done.

---

## Files touched this session

- `AI_STATE.md`
- `.claude/ai_state_archive.json`
- `docs/epics/07-frontend-architecture.md`
- `frontend/index.html`
- `frontend/js/app.js`
- `version.json`
- `docs/epics/07-frontend-architecture.md`
- `docs/roadmap.md`

---

## Automation log (latest only)

- 2026-04-28 09:30:00 [F7-3 Done — rules table migrated to DataTable]
  - branch: main
  - last_commit: f246d85
  - changed_files: frontend/index.html, frontend/js/app.js, version.json, docs/epics/07-frontend-architecture.md, docs/roadmap.md, AI_STATE.md
  - git_status: clean
