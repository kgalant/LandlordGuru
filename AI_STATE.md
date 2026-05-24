# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E2 Account and Property Management
- ID: F2-11
- Title: Full country list in Add Property dialog
- Short summary: Replace hardcoded DK/PL/Other dropdown with full ISO 3166-1 list; used countries float to top; Intl.DisplayNames for localisation; COUNTRY_CURRENCIES map for currency auto-fill; dashboard Active Properties tile shows dynamic country breakdown.

---

## Previous focus

- Type: feature
- Epic: E4 Reporting and Analytics
- ID: F4-1+F4-2
- Title: P&L report — backend API + frontend UI
- Short summary: Done — GET /api/reports/pnl with date/property/account filters, recursive CTE, currency toggle, print CSS. Committed + deployed.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Add `countryDisplayName(code)` helper (Intl.DisplayNames) + static ISO 3166-1 alpha-2 array to `frontend/js/strings.js`; add `COUNTRY_CURRENCIES` map (country code → default ISO 4217 currency)
- [x] S2: Update `openPropertyModal()` in `frontend/js/app.js` — build country dropdown dynamically: used countries at top with divider, all ISO countries below, auto-fill currency on selection
- [x] S3: Remove hardcoded `<option>` tags for country from `frontend/index.html`
- [x] S4: Update dashboard "Active properties" tile — replace hardcoded `X DK · X PL` with dynamic breakdown using `countryDisplayName()`

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12, F5-15
- Next MVP candidates: F3-8, F3-12, F3-13, F5-7
- Post-MVP backlog: F3-14, F3-15, F3-16, F3-19, E6 (tags & rules)

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

S1: Add `countryDisplayName(code)` helper + static ISO 3166-1 alpha-2 array + `COUNTRY_CURRENCIES` map to `frontend/js/strings.js`.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`
  - Manual: open Add Property modal — verify full country list, used countries at top, currency auto-fills

- Last result:
  - Date/time: 2026-05-15
  - Outcome: All new split tests pass in isolation (10/10). Full suite has pre-existing cascade failures due to SSH tunnel latency.

---

## Files touched this session

- `AI_STATE.md`
- `frontend/index.html`
- `frontend/css/style.css`
- `version.json`
- `deploy-prod.sh` (new)
- `deploy-test.sh`
- `scripts/prod-deploy.sh`
- `PROJECT_LANDLORDGURU.md`
- `backend/.env.example`

---

## Automation log (latest only)

- 2026-05-24 [fix + deploy infra: checkbox width + deploy-prod.sh]
  - branch: main
  - last_commit: 0e7c8d0
  - changed_files: frontend/index.html, frontend/css/style.css, version.json, deploy-prod.sh, deploy-test.sh, scripts/prod-deploy.sh, PROJECT_LANDLORDGURU.md, backend/.env.example, AI_STATE.md
  - git_status: clean
