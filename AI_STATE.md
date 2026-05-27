# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E5 Integrations & Data Import / E6 Rules
- ID: F5-16
- Title: Rules rework + import profile removal
- Short summary: Replace bank-profile-scoped rules with property-scoped rules (junction table). Remove all import profiles (BANK_PROFILES, localStorage presets, save/load UI). Rules now match by keyword + optional property list. **Complete — committed.**

---

## Previous focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-15
- Title: Multi-select filters for Property, Category, and Type
- Short summary: Done — DataTable multi-select filter type, backend multi-value params, frontend wiring.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Migration 025 — create rule_properties table, migrate property_id, drop bank_profile + property_id from rules
- [x] S2: Backend rules.js — property_ids arrays in GET/POST, remove bank_profile, new PUT /:id/properties endpoint
- [x] S3: Backend app.js — remove description-mappings route; delete description-mappings route/test files
- [x] S4: Tests — rewrite rules.test.js (no bank_profile, add property_ids + PUT /properties tests); update globalSetup.js
- [x] S5: Frontend importer.js — applyRules uses propertyId not profileKey; parseCSV removes profileKey param; source hardcoded to 'import'; add applyRulesToRow
- [x] S6: Frontend app.js — remove BANK_PROFILES, descMappings, profile functions, localStorage mapping fns, loadDefaultRules; update txRow, initRulesTable, saveRuleModal, onRowFieldChange re-evaluation
- [x] S7: Frontend api.js — remove getDescMappings/saveDescMapping/deleteDescMapping; add setRuleProperties; clean up getRules
- [x] S8: Frontend index.html — remove profile dropdown, saved mappings row, save mapping UI, loadDefaultRules card; update rule modal to property checklist
- [x] S9: Run migration + tests (300/300 passing); add maxWorkers:1 to jest config to fix pre-existing parallel test isolation race

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

Pick the next feature from `docs/roadmap.md` — top MVP candidates are F3-8, F3-12, F3-13, F5-7. Read the epic doc for the chosen item, propose a task breakdown, and confirm with user before starting.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`
  - Manual: import page (no profile dropdown), rules page (property checklist in modal), import row property change triggers rule re-eval

- Last result:
  - Date/time: 2026-05-27
  - Outcome: 300/300 tests passing (serial, via maxWorkers:1 in jest config).

---

## Files touched this session

- `backend/src/db/migrations/025_rules_rework.js` (new)
- `backend/src/routes/rules.js`
- `backend/src/app.js`
- `backend/src/routes/description-mappings.js` (deleted)
- `backend/tests/rules.test.js`
- `backend/tests/globalSetup.js`
- `backend/tests/description-mappings.test.js` (deleted)
- `backend/package.json`
- `frontend/config.js`
- `frontend/js/importer.js`
- `frontend/js/app.js`
- `frontend/js/api.js`
- `frontend/index.html`
- `frontend/version.json`
- `AI_STATE.md`
- `docs/ai_state_archive.json`

---

## Automation log (latest only)

- 2026-05-27 [F5-16 complete — 300/300 tests passing]
  - branch: main
  - last_commit: eee850a
  - changed_files: backend/src/db/migrations/025_rules_rework.js, backend/src/routes/rules.js, backend/src/app.js, backend/tests/rules.test.js, backend/tests/globalSetup.js, backend/package.json, frontend/config.js, frontend/js/importer.js, frontend/js/app.js, frontend/js/api.js, frontend/index.html, frontend/version.json, AI_STATE.md, docs/ai_state_archive.json
  - git_status: all changes staged, ready to commit
