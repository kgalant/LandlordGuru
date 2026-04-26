# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: chore
- Epic: E6 Architecture
- ID: C6-1
- Title: Refactor frontend inline JS to ES modules
- Short summary: Break ~1,900 lines of inline JS in index.html into ES module files. Convert existing js/*.js globals to exports, extract AUTH and APP sections by domain, wire up via a single `<script type="module">` entry point.

---

## Previous focus

None

---

## Task breakdown (current focus)

- [x] S1: Convert existing js files (config.js, api.js, strings.js, importer.js, reports.js, debug.js) to ES modules — add export statements.
- [x] S2: Extract AUTH inline block → js/auth.js as ES module.
- [x] S3: Extract APP inline block → js/app.js as ES module with imports and window bindings.
- [x] S4: Create js/main.js entry point.
- [x] S5: Update index.html — removed 1886 lines of inline JS, replaced 8 script tags with single `<script type="module" src="js/main.js">`, fixed FOUC on #app.
- [-] S6: Smoke test in browser — verify all pages load and function correctly.

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: B2-1-1, B3-1-1 (referenced in backlog but not yet documented in epic docs — investigate before picking up)
- Backlog features: F1-11, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md`      (E3)
- `docs/epics/04-reporting-analytics.md`         (E4)
- `docs/epics/05-integrations-data-import.md`    (E5)
- `docs/epics/06-architecture-backend.md`        (E6)

---

## Next step

S6: Open the app in a browser, verify login, navigation, all 6 pages, and the import flow work correctly.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-26 06:14:00
  - Outcome: 24/24 rules tests passing. F5-3 verified complete and committed (262ad7a).

---

## Files touched this session

- `AI_STATE.md`
- `frontend/config.js`
- `frontend/js/strings.js`
- `frontend/js/api.js`
- `frontend/js/importer.js`
- `frontend/js/reports.js`
- `frontend/js/debug.js`
- `frontend/js/auth.js` (new)
- `frontend/js/app.js` (new)
- `frontend/js/main.js` (new)
- `frontend/index.html`

---

## Automation log (latest only)

- 2026-04-26 09:30:00 [chore: deploy.sh committed]
  - branch: main
  - last_commit: eb7d4d8 chore: add deploy.sh — bash port of deploy.ps1, auto-detects homedev vs remote
  - changed_files: deploy.sh, AI_STATE.md, .claude/ai_state_archive.json
  - git_status: clean
