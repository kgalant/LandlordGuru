# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E1 + E3
- ID: F1-12 + F3-6
- Title: Date display format preference + Reconciliation marking
- Short summary: F1-12 adds a workspace date format setting (YYYY-MM-DD / MM-DD-YYYY / DD-MM-YYYY) applied to all date displays. F3-6 adds a per-row reconciled toggle button, visual distinction, and unreconciled-only filter.

---

## Previous focus

- Type: feature
- Epic: E5 Integrations and Data Import
- ID: F5-9/10/11
- Title: Import preview — row locking, sortable columns, notes highlight
- Short summary: Done and committed (6b18a3e).
- State: done

---

## Task breakdown (current focus)

- [x] F1-12/F3-6-1: Migration + backend (date_format column + workspace settings; reconciled filter in GET /api/transactions); backend tests; frontend (fmtDate, date surfaces, reconciled toggle + filter); strings; CSS; epic docs; version; commit

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-10, F3-11, F3-12
- Next MVP candidates: F2-6, F2-7, F3-8, F3-10, F3-11, F4-1+F4-2

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md` (E3)
- `docs/epics/04-reporting-analytics.md` (E4)
- `docs/epics/05-integrations-data-import.md` (E5)

---

## Next step

Confirm commit for F1-12 + F3-6 with user, then select next feature.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-03
  - Outcome: 232/232 tests passing (5 new tests for date_format and reconciled filter).

---

## Files touched this session

- `AI_STATE.md`
- `docs/ai_state_archive.json`
- `frontend/js/app.js`
- `frontend/index.html`
- `frontend/js/strings.js`
- `frontend/css/style.css`
- `version.json`
- `docs/epics/01-workspace-user-management.md`
- `docs/epics/03-transaction-management.md`
- `docs/epics/05-integrations-data-import.md`
- `docs/roadmap.md`
- `backend/src/routes/workspace.js`
- `backend/src/routes/transactions.js`
- `backend/src/db/migrations/019_date_format.js`
- `backend/tests/workspace.test.js`
- `backend/tests/transactions.test.js`

---

## Automation log (latest only)

- 2026-05-03 [F1-12+F3-6 complete, awaiting commit]
  - branch: main
  - last_commit: 6b18a3e feat: F5-9/10/11 — row locking, sortable columns, notes highlight in import preview
  - changed_files: AI_STATE.md, docs/ai_state_archive.json, frontend/js/app.js, frontend/index.html, frontend/js/strings.js, frontend/css/style.css, version.json, docs/epics/01-workspace-user-management.md, docs/epics/03-transaction-management.md, backend/src/routes/workspace.js, backend/src/routes/transactions.js, backend/src/db/migrations/019_date_format.js, backend/tests/workspace.test.js, backend/tests/transactions.test.js
  - git_status: M AI_STATE.md, M docs/ai_state_archive.json, M frontend/js/app.js, M frontend/index.html, M frontend/js/strings.js, M frontend/css/style.css, M version.json, M docs/epics/01-workspace-user-management.md, M docs/epics/03-transaction-management.md, M docs/epics/05-integrations-data-import.md, M docs/roadmap.md, M backend/src/routes/workspace.js, M backend/src/routes/transactions.js, M backend/tests/workspace.test.js, M backend/tests/transactions.test.js, ?? backend/src/db/migrations/019_date_format.js, ?? .claude/hooks/checkpoint.sh

- 2026-05-03 08:40:24 [Stop]
  - branch: main
  - last_commit: 6b18a3e feat: F5-9/10/11 — row locking, sortable columns, notes highlight in import preview
  - changed_files: AI_STATE.md,backend/src/routes/transactions.js backend/src/routes/workspace.js,backend/tests/transactions.test.js backend/tests/workspace.test.js,docs/ai_state_archive.json docs/epics/01-workspace-user-management.md,docs/epics/03-transaction-management.md docs/epics/05-integrations-data-import.md,frontend/css/style.css frontend/index.html,frontend/js/app.js frontend/js/strings.js,version.json
  - git_status:
     M AI_STATE.md
     M backend/src/routes/transactions.js
     M backend/src/routes/workspace.js
     M backend/tests/transactions.test.js
     M backend/tests/workspace.test.js
     M docs/ai_state_archive.json
     M docs/epics/01-workspace-user-management.md
     M docs/epics/03-transaction-management.md
     M docs/epics/05-integrations-data-import.md
     M frontend/css/style.css
     M frontend/index.html
     M frontend/js/app.js
     M frontend/js/strings.js
     M version.json
    ?? .claude/hooks/checkpoint.sh
    ?? backend/src/db/migrations/019_date_format.js

- 2026-05-03 08:45:36 [Stop]
  - branch: main
  - last_commit: 6b18a3e feat: F5-9/10/11 — row locking, sortable columns, notes highlight in import preview
  - changed_files: AI_STATE.md,backend/src/routes/transactions.js backend/src/routes/workspace.js,backend/tests/transactions.test.js backend/tests/workspace.test.js,docs/ai_state_archive.json docs/epics/01-workspace-user-management.md,docs/epics/03-transaction-management.md docs/epics/05-integrations-data-import.md,frontend/css/style.css frontend/index.html,frontend/js/app.js frontend/js/datatable.js,frontend/js/strings.js version.json
  - git_status:
     M AI_STATE.md
     M backend/src/routes/transactions.js
     M backend/src/routes/workspace.js
     M backend/tests/transactions.test.js
     M backend/tests/workspace.test.js
     M docs/ai_state_archive.json
     M docs/epics/01-workspace-user-management.md
     M docs/epics/03-transaction-management.md
     M docs/epics/05-integrations-data-import.md
     M frontend/css/style.css
     M frontend/index.html
     M frontend/js/app.js
     M frontend/js/datatable.js
     M frontend/js/strings.js
     M version.json
    ?? .claude/hooks/checkpoint.sh
    ?? backend/src/db/migrations/019_date_format.js
