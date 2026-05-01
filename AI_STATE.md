# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E2 Account and Property Management
- ID: F2-2
- Title: Property list UI
- Short summary: Frontend view showing all active properties with key fields; archived toggle; clicking a property opens its edit view.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F2-2-1: Backend — add `?include_archived=true` support to `GET /api/properties`; return `active` field on each row; add/update tests
- [x] F2-2-2: Frontend — "Show archived" toggle; re-fetch with flag when toggled; show archived badge on archived cards
- [x] F2-2-3: Frontend — make whole property card clickable (opens edit modal), not just the Edit button; keep Delete button separate
- [x] F2-2-4: Smoke-test full flow; update epic doc status to Done; commit

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F1-12, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)
- Next MVP candidates (Wave 3): F2-6, F2-7 (after F2-2 ships)
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

Select next focus from Wave 3 candidates: F2-6 or F2-7. Read roadmap to confirm ordering.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-01 10:03:49
  - Outcome: 195/195 tests passing. F2-2 complete.

---

## Files touched this session

- `backend/src/routes/properties.js`
- `backend/tests/properties.test.js`
- `frontend/index.html`
- `frontend/js/api.js`
- `frontend/js/app.js`
- `frontend/js/strings.js`
- `docs/epics/02-account-property-management.md`
- `AI_STATE.md`
- `.claude/ai_state_archive.json`

---

## Automation log (latest only)

- 2026-05-01 13:30:00 F2-2 done — property list UI committed (v2.12.0)
  - branch: main
  - last_commit: 0c88ee3
  - changed_files: backend/src/routes/properties.js, backend/tests/properties.test.js, frontend/index.html, frontend/js/api.js, frontend/js/app.js, frontend/js/strings.js, docs/epics/02-account-property-management.md, version.json, AI_STATE.md, .claude/ai_state_archive.json
  - git_status: clean after commit
