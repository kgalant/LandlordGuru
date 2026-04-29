# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E5 Integrations and Data Import
- ID: F5-4
- Title: Description mappings backend
- Short summary: Migrate user-captured description→category+property mappings from localStorage to the backend so they survive device changes.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [ ] F5-4-1: Add migration for `description_mappings` table; define schema and unique key `(workspace_id, bank_profile, user_id, keyword)`
- [ ] F5-4-2: Implement `GET`, `POST` (upsert), and `DELETE` routes at `/api/description-mappings`
- [ ] F5-4-3: Add backend tests for all three endpoints
- [ ] F5-4-4: Update frontend to read from API instead of localStorage on import preview load; write to API when a mapping is saved

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

Add migration for `description_mappings` table (F5-4-1).

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-30 00:00:00
  - Outcome: 161/161 tests passing. F7-5 smoke-tested on homedev and confirmed Done. Header alignment fix verified.

---

## Files touched this session

- `AI_STATE.md`
- `AI_STATE-GUIDE.md`

---

## Automation log (latest only)

- 2026-04-30 [housekeeping — removed phantom bug IDs B2-1-1/B3-1-1; set F5-4 as current focus]
  - branch: main
  - last_commit: 644ec50
  - changed_files: AI_STATE.md, AI_STATE-GUIDE.md
  - git_status: M AI_STATE.md, M AI_STATE-GUIDE.md
