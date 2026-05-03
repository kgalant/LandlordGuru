# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E5 Integrations / E7 Frontend Architecture
- ID: F5-import-sticky
- Title: Import preview sticky header fix
- Short summary: Toggles row (bulk-update, group, float, lock-btn) was not sticky — only the card header was. Wrapping both in #import-preview-sticky so both stick together when scrolling.

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

- [-] S1: Wrap card-header + toggles row in #import-preview-sticky; move sticky CSS to wrapper; style #import-preview-toggles. Commit.

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

Commit the import preview sticky header fix.

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

- 2026-05-03 [date-filters + columns-dropdown done]
  - branch: main
  - last_commit: 7ca85e1 fix: date filter UX — auto-separators, year fills date range, columns dropdown alignment
  - changed_files: AI_STATE.md
  - git_status: M AI_STATE.md, ?? .claude/hooks/checkpoint.sh

- 2026-05-03 09:51:17 [Stop]
  - branch: main
  - last_commit: 7ca85e1 fix: date filter UX — auto-separators, year fills date range, columns dropdown alignment
  - changed_files: AI_STATE.md
  - git_status:
     M AI_STATE.md
    ?? .claude/hooks/checkpoint.sh
