# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E5 Integrations & Data Import
- ID: B5-1
- Title: Import bugfixes — category type resolution + mapping confirmation property
- Short summary: Two bugs found during import testing. (1) `parseCSV` called `categoryToType` without `apiCategories`, so custom categories always fell back to 'expense' type → invalid category errors. (2) Mapping confirmation screen showed only description + category; now includes a property dropdown (defaulting to the row's property, "All properties" option for no restriction).

---

## Previous focus

- Type: feature
- Epic: E5 Integrations & Data Import / E6 Rules
- ID: F5-16
- Title: Rules rework + import profile removal
- Short summary: Complete — committed (23cd157).
- State: done

---

## Task breakdown (current focus)

- [x] S1: Fix categoryToType called without apiCategories in parseCSV (importer.js + app.js)
- [x] S2: Add property dropdown to mapping confirmation screen (app.js + strings.js)

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12, F5-15, F5-17
- Next MVP candidates: F3-8, F3-12, F3-13, F5-7
- Post-MVP backlog: F3-14, F3-16, F3-19, E6 (tags & rules)

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md` (E3)
- `docs/epics/04-reporting-analytics.md` (E4)
- `docs/epics/05-integrations-data-import.md` (E5)
- `docs/epics/06-tags-rules.md` (E6 — new)
- `docs/epics/07-frontend-architecture.md` (E7)

---

## Next step

Test both fixes manually: (1) import a CSV with a custom-category rule and confirm no "not valid for type" errors; (2) check the mapping confirmation screen shows a property dropdown with correct default and "All properties" option. Then commit.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`
  - Manual: import with custom-category rule (no type errors); mapping confirmation shows property dropdown

- Last result:
  - Date/time: 2026-05-27
  - Outcome: 300/300 tests passing (serial, via maxWorkers:1 in jest config). Manual re-test pending for these fixes.

---

## Files touched this session

- `frontend/js/importer.js`
- `frontend/js/app.js`
- `frontend/js/strings.js`
- `AI_STATE.md`

---

## Automation log (latest only)

- 2026-05-29 [B5-1 import bugfixes — category type + mapping confirmation property]
  - branch: main
  - last_commit: 23cd157
  - changed_files: frontend/js/importer.js, frontend/js/app.js, frontend/js/strings.js, AI_STATE.md
  - git_status: M frontend/js/importer.js, M frontend/js/app.js, M frontend/js/strings.js, M AI_STATE.md
