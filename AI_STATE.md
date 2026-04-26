# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E6 Architecture
- ID: F6-6
- Title: Frontend debug panel
- Short summary: Hidden version label (bottom-right, near-invisible) that toggles a debug panel showing frontend/backend version, environment, auth user, token expiry, last sync, and API health. Backend adds `GET /api/version`. Deploy scripts inject `GIT_COMMIT`.

---

## Previous focus

- Type: chore
- Epic: E6 Architecture
- ID: C6-1
- Title: Refactor frontend inline JS to ES modules
- Short summary: Broke ~1,900 lines of inline JS in index.html into ES modules (js/auth.js, js/app.js, js/main.js). All subtasks complete.
- State: paused
- Return point: S6 (browser smoke test) was in-progress but refactor is shipped — smoke test can be done as part of F6-6 verification.

---

## Task breakdown (current focus)

- [x] S1: Add `GET /api/version` backend route — returns `{ version, environment, commit }` from package.json / NODE_ENV / GIT_COMMIT env var. No auth required.
- [x] S2: Update `deploy.ps1` and `deploy.sh` to inject `GIT_COMMIT` env var at deploy time.
- [x] S3: Add version label to frontend — bottom-right fixed, near-invisible style (text colour ≈ background), shows `v{semver}+{commit}`, only rendered when authenticated.
- [x] S4: Wire label click to toggle debug panel — panel shows all F6-6 spec fields (frontend version, backend version, environment, user, token expiry, last sync, API health). Escape closes.
- [x] S5: Test: verify `GET /api/version` shape; add to backend test suite. (161/161 passing)
- [-] S6: Browser smoke test — confirm label invisible at a glance, panel opens/closes, all fields populate.

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

S6: Deploy to homedev and smoke-test in browser — verify label is invisible, panel opens/closes, all fields populate correctly.

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
- `.claude/ai_state_archive.json`
- `backend/src/routes/version.js` (new)
- `backend/src/app.js`
- `backend/tests/version.test.js` (new)
- `deploy.sh`
- `deploy.ps1`
- `frontend/js/version-badge.js` (new)
- `frontend/js/main.js`
- `frontend/js/app.js`

---

## Automation log (latest only)

- 2026-04-26 10:30:00 [F6-6 committed — browser smoke test pending]
  - branch: main
  - last_commit: 7270df2 feat: F6-6 Frontend debug panel — version badge + /api/version endpoint
  - changed_files: backend/src/routes/version.js, backend/tests/version.test.js, frontend/js/version-badge.js, backend/src/app.js, deploy.sh, deploy.ps1, frontend/js/app.js, frontend/js/main.js, AI_STATE.md
  - git_status: clean
