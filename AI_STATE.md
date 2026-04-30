# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E5 Integrations and Data Import
- ID: F5-4
- Title: Description mappings backend
- Short summary: Done. All subtasks complete, smoke-tested on homedev.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F5-4-1: Add migration for `description_mappings` table; define schema and unique key `(workspace_id, bank_profile, user_id, keyword)`
- [x] F5-4-2: Implement `GET`, `POST` (upsert), and `DELETE` routes at `/api/description-mappings`
- [x] F5-4-3: Add backend tests for all three endpoints
- [x] F5-4-4: Update frontend to read from API instead of localStorage on import preview load; write to API when a mapping is saved

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
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

Read `docs/roadmap.md` and select the next focus from Wave 3 candidates (F2-2, F2-6, F2-7); confirm with user before starting.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-30
  - Outcome: 184/184 tests passing. F5-4 smoke-tested on homedev — mappings persist across devices, localStorage no longer used.

---

## Files touched this session

None (session end).

---

## Automation log (latest only)

- 2026-04-30 [F5-4 done — smoke-tested, closing out]
  - branch: main
  - last_commit: 1485143
  - changed_files: none
  - git_status: clean
