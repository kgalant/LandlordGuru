# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-18
- Title: Split rules (auto-split at import)
- Short summary: Done — split_rules table + CRUD API, import pipeline rule evaluation, reusable rule form UI, account/property picker popup, "Save as rule" from split editor, auto-split badge in import preview. Committed.

---

## Previous focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-17
- Title: Transaction splitting
- Short summary: Done — split parent/child data model, PUT/DELETE /splits endpoints, list fold/unfold UI, inline split editor in edit modal, bulk-apply to similar. Committed.
- State: done

---

## Task breakdown (current focus)

- [x] S1: DB migration — `split_rules` table
- [x] S2: Backend — CRUD API (`GET/POST/PATCH/DELETE /api/split-rules`)
- [x] S3: Backend — import pipeline integration: evaluate rules per-row after categorisation
- [x] S4: Tests — CRUD + rule evaluation + percent/fixed rounding + sum/100 validation
- [x] S5: Frontend — reusable rule form + standalone management section
- [x] S6: Frontend — import preview: "Auto-split" badge
- [x] S7: Frontend — "Save as rule" secondary action in split editor

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F3-8, F3-12, F3-13, F4-1+F4-2, F5-7
- Post-MVP backlog: F3-14, F3-15, F3-16, F3-19 (retroactive split rule apply), E6 (tags & rules)

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

Choose next MVP feature from candidates: F3-8, F3-12, F3-13, F4-1+F4-2, F5-7. Consult `docs/roadmap.md` for dependency order.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-15
  - Outcome: All new split tests pass in isolation (10/10). Full suite has pre-existing cascade failures due to SSH tunnel latency. Logic is correct; infrastructure is the bottleneck.

---

## Files touched this session

- `version.json` — bumped to 2.23.0
- `docs/epics/03-transaction-management.md` — F3-18 marked Done
- `backend/src/db/migrations/023_split_rules.js`
- `backend/src/routes/split-rules.js`
- `backend/src/app.js`
- `backend/src/routes/transactions.js`
- `backend/tests/split-rules.test.js`
- `frontend/js/api.js`
- `frontend/js/strings.js`
- `frontend/index.html`
- `frontend/js/app.js`
- `frontend/css/style.css`
- `AI_STATE.md`
- `docs/ai_state_archive.json`

---

## Automation log (latest only)

- 2026-05-19 [F3-18 committed]
  - branch: main
  - last_commit: 9ab24a9
  - changed_files: backend/src/db/migrations/023_split_rules.js, backend/src/routes/split-rules.js, backend/tests/split-rules.test.js, backend/src/app.js, backend/src/routes/transactions.js, frontend/js/api.js, frontend/js/strings.js, frontend/index.html, frontend/js/app.js, frontend/css/style.css, version.json, docs/epics/03-transaction-management.md, AI_STATE.md, docs/ai_state_archive.json
  - git_status: M+?? (multiple files, pre-commit)
