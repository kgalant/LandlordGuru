# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: —
- Epic: —
- ID: —
- Title: Pending selection
- Short summary: F7-5 closed out. Next focus to be selected from Wave 3 candidates: F2-2, F2-6, F2-7.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F7-5-1: Replace static mini-table in `index.html` with `<div id="dash-recent-table-wrap">`; remove card-header title+button (moves to DataTable)
- [x] F7-5-2: Add `initDashRecentTable()` and wire into `renderDashboard()` in `app.js`; delete dead `dash-recent-tx` DOM write
- [x] F7-5-3: Smoke-test on homedev — confirmed passing; also fixed DataTable column header alignment (amount/count/income/expenses/net headers now right-aligned to match data cells)

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

Select next focus from Wave 3 candidates (F2-2, F2-6, F2-7) or known bugs (B2-1-1, B3-1-1, F7-B1).

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-30 00:00:00
  - Outcome: 161/161 tests passing. F7-5 smoke-tested on homedev and confirmed Done. Header alignment fix verified.

---

## Files touched this session

- `frontend/js/datatable.js`
- `frontend/js/app.js`
- `.claude/ai_state_archive.json`
- `AI_STATE.md`

---

## Automation log (latest only)

- 2026-04-30 00:00:00 [F7-5 smoke-tested — DataTable header alignment fix applied and confirmed]
  - branch: main
  - last_commit: fc1dc31
  - changed_files: frontend/js/app.js, frontend/js/datatable.js, AI_STATE.md
  - git_status: clean
