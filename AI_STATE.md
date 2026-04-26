# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

None — awaiting next item selection.

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

N/A — no active focus.

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: B2-1-1, B3-1-1 (referenced in backlog but not yet documented in epic docs — investigate before picking up)
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

Confirm next item with user — likely a Wave 3 feature (F2-2, F2-6, F2-7) or a known bug (B2-1-1, B3-1-1).

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
- `backend/src/routes/version.js` (new)
- `backend/src/app.js`
- `backend/tests/version.test.js` (new)
- `deploy.sh`
- `deploy.ps1`
- `frontend/js/version-badge.js` (new)
- `frontend/js/main.js`
- `frontend/js/app.js`
- `docs/epics/06-architecture-backend.md`

---

## Automation log (latest only)

- 2026-04-26 11:00:00 [F6-6 done — smoke test passed]
  - branch: main
  - last_commit: 8eba2bf chore: update AI_STATE — F6-6 committed, smoke test pending
  - changed_files: docs/epics/06-architecture-backend.md, AI_STATE.md
  - git_status: M docs/epics/06-architecture-backend.md, M AI_STATE.md
