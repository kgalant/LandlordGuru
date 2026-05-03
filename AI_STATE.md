# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E3 Transaction Management / E7 Frontend Architecture
- ID: F3-date-filters + F7-B2
- Title: Date filter UX fixes + columns dropdown alignment
- Short summary: (1) Auto-insert separators in date text inputs as user types digits. (2) Year quick-select fills date-from/to inputs directly instead of being a separate filter layer. (3) Columns dropdown left-justified with tight checkbox+label spacing.

---

## Previous focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-10
- Title: Transaction edit modal with source-field override tracking
- Short summary: Done — migration 020 (original_date, original_amount), backend PATCH guard, currency field added to modal, override hints shown under date/amount/description, saveTxModal sends originals on first change.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Auto-insert date separators in DataTable date-range inputs (data-date-fmt attr + _autoInsertDateSep helper + input event handler) and in reports rep-from/rep-to (onDateFilterInput in app.js).
- [x] S2: Year select fills date-from/to inputs via setsDateRange: 'date' config + _fmtYearBound helper; remove year fallback from fetchData.
- [x] S3: Columns dropdown CSS — left-justify checkboxes, tight gap, clean label template.
- [-] S4: Update AI_STATE.md and commit.

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F2-6, F2-7, F3-8, F3-12, F4-1+F4-2, F5-7

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md` (E3)
- `docs/epics/04-reporting-analytics.md` (E4)
- `docs/epics/05-integrations-data-import.md` (E5)
- `docs/epics/07-frontend-architecture.md` (E7)

---

## Next step

Commit all changes (date filter fixes + columns dropdown tweak).

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-03
  - Outcome: 236/236 tests passing.

---

## Files touched this session

- `AI_STATE.md`
- `docs/ai_state_archive.json`
- `docs/epics/07-frontend-architecture.md`
- `frontend/css/datatable.css`
- `frontend/index.html`
- `frontend/js/app.js`
- `frontend/js/datatable.js`

---

## Automation log (latest only)

- 2026-05-03 [date-filters + columns-dropdown, pre-commit]
  - branch: main
  - last_commit: acf6427 fix: reconciliation UI fixes — modal checkbox, filter row layout, click target
  - changed_files: AI_STATE.md, docs/epics/07-frontend-architecture.md, frontend/css/datatable.css, frontend/index.html, frontend/js/app.js, frontend/js/datatable.js
  - git_status: M AI_STATE.md, M frontend/css/datatable.css, M frontend/index.html, M frontend/js/app.js, M frontend/js/datatable.js, M docs/epics/07-frontend-architecture.md, ?? .claude/hooks/checkpoint.sh
