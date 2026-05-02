# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E5 Integrations and Data Import
- ID: F5-13
- Title: Group-by-status and float-selected in import preview
- Short summary: Two toolbar toggle buttons — "Group" splits rows into five collapsible sections by status; "Float selected" pulls selected rows to the top. Frontend-only.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [-] F5-13-1: Add `_userPickedProperty` flag; extract `_buildRowHtml`; add `_rowSection`, `renderImportTable`, `toggleImportSection`, `_rerenderIfGrouped`; wire toggles in HTML; CSS for section headers
- [ ] F5-13-2: Wire re-render triggers into `onRowFieldChange`, `onRowSelect`, `toggleSelectAll`, `_applyDupResult`; add strings; commit

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F1-12, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11
- Next MVP candidates: F2-6, F2-7

Relevant epic docs:

- `docs/epics/05-integrations-data-import.md` (E5)

---

## Next step

Implement F5-13-1: extract `_buildRowHtml`, add grouping/float logic, wire HTML toggles and CSS.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-02 (this session)
  - Outcome: 227/227 tests passing.

---

## Files touched this session

- `AI_STATE.md`
- `docs/epics/05-integrations-data-import.md`
- `frontend/index.html`
- `frontend/js/app.js`
- `frontend/js/strings.js`
- `frontend/css/style.css`

---

## Automation log (latest only)

- 2026-05-02 [F5-13 focus set]
  - branch: main
  - last_commit: 2f03e78
  - changed_files: AI_STATE.md
  - git_status: M AI_STATE.md
