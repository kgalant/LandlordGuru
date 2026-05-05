# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E7 Frontend Architecture / Infrastructure
- ID: F7-B1
- Title: Sort by property sorts by ID not name
- Short summary: Done — joined `properties as p` in `GET /api/transactions` base query; `SORT_COLS.property` now maps to `p.name`. Regression test added, 70/70 tx tests pass.

---

## Previous focus

- Type: chore
- Epic: E7 Frontend Architecture / Infrastructure
- ID: C-build-arch-1
- Title: Three-environment build architecture
- Short summary: Done — scripts, npm start:local, docs updated. All three envs (local dev/test/prod) verified working.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Add `LEFT JOIN properties as p` to base query; change `SORT_COLS.property` from `ap.property_id` to `p.name`
- [x] S2: Add regression test for `sort_col=property` sorting alphabetically by name
- [x] S3: Update epic doc status, bump version.json (2.20.0 → 2.20.1), commit

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F2-6, F2-7, F3-8, F3-12, F3-13, F3-17, F3-18, F4-1+F4-2, F5-7
- Post-MVP backlog added: F3-14 (year multi-select), F3-15 (multi-select filters), F3-16 (filter tooltip), E6 (tags & rules)

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

Confirm next Current focus with user, then update AI_STATE.md and begin task breakdown.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-05
  - Outcome: 70/70 transaction tests passing (236 total; 4 accounts tests fail only when run together due to pre-existing isolation issue, not caused by this fix).

---

## Files touched this session

- `AI_STATE.md`
- `docs/ai_state_archive.json`
- `backend/src/routes/transactions.js`
- `backend/tests/transactions.test.js`
- `docs/epics/07-frontend-architecture.md`
- `version.json`
- `backend/.env.test` (local only, git-ignored)

---

## Automation log (latest only)

- 2026-05-05 [F7-B1 done]
  - branch: main
  - last_commit: 250e853
  - changed_files: AI_STATE.md, docs/ai_state_archive.json, backend/src/routes/transactions.js, backend/tests/transactions.test.js, docs/epics/07-frontend-architecture.md, version.json
  - git_status: M AI_STATE.md, M backend/src/routes/transactions.js, M backend/tests/transactions.test.js, M docs/ai_state_archive.json, M docs/epics/07-frontend-architecture.md, M version.json
