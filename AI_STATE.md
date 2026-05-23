# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E4 Reporting and Analytics
- ID: F4-1+F4-2
- Title: P&L report — backend API + frontend UI
- Short summary: Done — GET /api/reports/pnl with date/property/account filters, recursive CTE, property via account_properties join. renderReports() replaced with API call; currency toggle; print CSS. Committed + deployed to test.

---

## Previous focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-18
- Title: Split rules (auto-split at import)
- Short summary: Done — split_rules table + CRUD API, import pipeline rule evaluation, reusable rule form UI, account/property picker popup, "Save as rule" from split editor, auto-split badge in import preview. Committed.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Backend — `GET /api/reports/pnl` in `backend/src/routes/reports.js` (date range, property_id, account_id/account_scope filters; recursive CTE for account descendants; group by category+currency; exclude transfers/inter_account)
- [x] S2: Backend — Register reports route in `backend/src/app.js`
- [x] S3: Tests — `backend/tests/reports.test.js` (date range, property filter, transfer exclusion, category grouping, account filter exact vs recursive) — 14/14 pass
- [x] S4: Frontend — Replace `renderReports()` client-side computation with `/api/reports/pnl` API call; map response to DataTable arrays
- [x] S5: Frontend — Currency toggle (native amounts vs converted to reporting currency)
- [x] S6: Frontend — Print-friendly CSS (`@media print`)

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

Choose next MVP feature from candidates. Consult `docs/roadmap.md`. F4-1+F4-2 is done — F4-3 (per-property P&L breakdown), F3-8, F3-12, F3-13, F5-7 remain.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-15
  - Outcome: All new split tests pass in isolation (10/10). Full suite has pre-existing cascade failures due to SSH tunnel latency. Logic is correct; infrastructure is the bottleneck.

---

## Files touched this session

- `AI_STATE.md`
- `backend/src/routes/reports.js` (new)
- `backend/src/app.js`
- `backend/tests/reports.test.js` (new)
- `frontend/js/api.js`
- `frontend/js/app.js`
- `frontend/js/strings.js`
- `frontend/index.html`
- `frontend/css/style.css`
- `version.json`
- `deploy-test.sh`

---

## Automation log (latest only)

- 2026-05-23 [F4-1+F4-2 committed + deployed to test]
  - branch: main
  - last_commit: 791325f
  - changed_files: backend/src/routes/reports.js, backend/src/app.js, backend/tests/reports.test.js, frontend/js/api.js, frontend/js/app.js, frontend/js/strings.js, frontend/index.html, frontend/css/style.css, version.json, deploy-test.sh, AI_STATE.md, docs/ai_state_archive.json
  - git_status: clean
