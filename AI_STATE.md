# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E2 Account and Property Management
- ID: B2-2-1
- Title: Dashboard property card display issues
- Short summary: Fix `null`/`NaN` values in dashboard property card rendering (address showing "null", monthly showing "DKKNaN" due to parseFloat failures).

---

## Previous focus

None

---

## Completed work this session

- ✅ **B2-2-1**: Fixed dashboard property card null/NaN display issues
  - Address field now shows "no address registered" (grayed italic) instead of "null"
  - Monthly rent calculation fixed with parseFloat conversions
  - Deployed to dev server, tested in browser, all tests passing (60/60)

---

## Task breakdown (current focus)

- [x] S1: Identify where dashboard property cards are populated and reproduce the `null`/`DKKNaN` rendering issues.
- [x] S2: Verify the code fix (parseFloat, null-coalescing for address) works correctly via npm test and manual browser testing.
- [x] S3: Commit the fix with updated AI_STATE.md.

---

## Backlog pointers

- Next candidate features: F2-2, F3-1, F5-4
- Known bugs: B2-1-1, B3-1-1

Relevant epic docs:

- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md`      (E3)
- `docs/epics/04-reporting-analytics.md`         (E4)
- `docs/epics/05-integrations-data-import.md`    (E5)
- `docs/epics/06-architecture-backend.md`        (E6)

---

## Next step

Review backlog and select next candidate feature (F2-2, F3-1, or F5-4) or known bug (B2-1-1, B3-1-1) to work on.

---

## Validation

- Commands to run:
  - `npm test` (from backend/)
  - Manual browser test on dev server

- Last result:
  - Date/time: 2026-04-18 22:40:00
  - Outcome: ✅ B2-2-1 complete. All 60 tests passing. Dashboard fix deployed and verified in browser.

---

## Files touched this session

- frontend/index.html (fixed renderDashboard to handle null address and parseFloat rent/aconto)
- deploy.ps1 (PowerShell deploy script with nvm sourcing)
- AI_STATE.md (task breakdown, validation, completed work, automation log)
- CLAUDE.md (restructured to workflow-only)
- PROJECT_LANDLORDGURU.md (new — app-specific rules)
- AI_STATE-GUIDE.md (new — AI_STATE.md structure reference)
- docs/epics/00-index.md (E-prefixed IDs, numbering convention, E6 added)
- docs/epics/06-architecture-backend.md (new — E6 epic)

---

## Automation log (latest only)

- 2026-04-18 22:40:00 session housekeeping complete
  - branch: main
  - lastcommit: 91ccfa4
  - changedfiles: AI_STATE.md, docs/epics/00-index.md, docs/epics/06-architecture-backend.md
  - gitstatus: M AI_STATE.md, M docs/epics/00-index.md, ?? docs/epics/06-architecture-backend.md
