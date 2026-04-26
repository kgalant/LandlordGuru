# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E5 Integrations and Data Import
- ID: F5-11
- Title: Highlight missing required notes in import preview
- Short summary: Visually flag notes inputs red when category is `other_expense` and notes are empty; block import submission until all such rows are filled.

---

## Previous focus

- Type: feature
- Epic: E6 Architecture
- ID: F6-6
- Title: Frontend debug panel
- Short summary: Near-invisible version label (bottom-right) toggling a debug panel with frontend/backend version, environment, auth user, token TTL, last sync, and API health. GET /api/version added. GIT_COMMIT injected by deploy scripts.
- State: done

---

## Task breakdown (current focus)

- [x] F5-11-1: Red-highlight notes input in real time when category is `other_expense` + notes empty; block "Next: Review →" with toast if any active row still fails that check.

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: B2-1-1, B3-1-1 (referenced in backlog but not yet documented in epic docs — investigate before picking up)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)
- Next MVP candidates (Wave 3): F2-2, F2-6, F2-7

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md`      (E3)
- `docs/epics/04-reporting-analytics.md`         (E4)
- `docs/epics/05-integrations-data-import.md`    (E5)
- `docs/epics/06-architecture-backend.md`        (E6)

---

## Next step

Deploy to homedev and smoke-test: verify red highlight appears on `other_expense` rows with empty notes, clears on fill/category change, and "Next: Review →" is blocked until all notes are filled.

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
- `frontend/js/app.js`
- `frontend/js/strings.js`
- `frontend/version.json`
- `docs/epics/06-architecture-backend.md`

---

## Automation log (latest only)

- 2026-04-26 [F5-11 done — committed c5540df; F6-7 added to backlog 3be0e88]
  - branch: main
  - last_commit: 3be0e88
  - changed_files: frontend/js/app.js, frontend/js/strings.js, frontend/version.json, docs/epics/06-architecture-backend.md, AI_STATE.md, .claude/ai_state_archive.json
  - git_status: clean
