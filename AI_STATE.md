# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E7 Frontend Architecture
- ID: F7-1
- Title: DataTable component — core build
- Short summary: Create `frontend/js/datatable.js` and `frontend/css/datatable.css` — the standalone reusable DataTable component with sticky layout, sorting, filtering, pagination, bulk actions, and column visibility. No table migrations in this step.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [ ] F7-1-1: Scaffold `datatable.css` (sticky flexbox layout, base table styles) and `datatable.js` (module skeleton, `DataTable.create()` entry point); wire up `<link>` in `index.html`
- [ ] F7-1-2: Render header bar (title, action buttons, ⚙ column-visibility toggle placeholder)
- [ ] F7-1-3: Render filter bar (per-column filter controls; hide entire bar when no filters configured)
- [ ] F7-1-4: Render column headers with sort indicators; handle click-to-sort, track sort state internally
- [ ] F7-1-5: Render scrollable body via `renderRow` callback; pass `visibleCols` correctly
- [ ] F7-1-6: Render sticky footer with pagination controls and rows-per-page dropdown; track page state internally
- [ ] F7-1-7: Implement bulk-actions bar (checkbox column, bulk action buttons)
- [ ] F7-1-8: Implement column visibility (⚙ dropdown, localStorage persistence, hide column + its filter + reset filter value)
- [ ] F7-1-9: Expose `table.refresh()` and `table.reset()` on returned instance; smoke-test all config combinations

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: B2-1-1, B3-1-1 (referenced in backlog but not yet documented in epic docs — investigate before picking up)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)
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

Start F7-1-1: create `frontend/css/datatable.css` with the sticky flexbox layout skeleton, create `frontend/js/datatable.js` with the `DataTable.create()` module shell, and add the `<link>` tag in `index.html`.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-26 10:30:00
  - Outcome: 161/161 tests passing. F6-6 deployed and smoke-tested on homedev.

---

## Files touched this session

- `AI_STATE.md`
- `.claude/ai_state_archive.json`
- `docs/epics/07-frontend-architecture.md`
- `docs/epics/00-index.md`

---

## Automation log (latest only)

- 2026-04-26 [F7-1 set as current focus]
  - branch: main
  - last_commit: e7caa26
  - changed_files: docs/epics/07-frontend-architecture.md, docs/epics/00-index.md, AI_STATE.md, .claude/ai_state_archive.json
  - git_status: clean
