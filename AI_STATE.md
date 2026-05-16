# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-18
- Title: Split rules (auto-split at import)
- Short summary: Allow users to define split rules that automatically split matching transactions during import. Rules have conditions (field/operator/value) and a template (child allocations as fixed or percent). New `split_rules` table, management UI, and import pipeline integration.

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

- [ ] S1: DB migration — `split_rules` table (`id`, `workspace_id`, `name`, `enabled`, `conditions` JSONB, `template` JSONB, `created_at`, `created_by`)
- [ ] S2: Backend — CRUD API for split rules (`GET/POST/PATCH/DELETE /api/split-rules`)
- [ ] S3: Backend — import pipeline integration: evaluate rules after categorisation, apply first matching rule, return `auto_split` flag in import preview
- [ ] S4: Tests — CRUD + rule evaluation + percent/fixed rounding edge cases
- [ ] S5: Frontend — split rules management UI (condition builder, template rows, enable/disable toggle)
- [ ] S6: Frontend — import preview: show "Auto-split" badge on auto-split rows
- [ ] S7: Frontend — retroactive apply: "Apply rules to existing transactions" action with preview

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F3-8, F3-12, F3-13, F3-18, F4-1+F4-2, F5-7
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

Plan F3-18 with user before implementing: understand scope, dependency on F5-3 import pipeline, and whether retroactive apply (S7) is in scope for MVP.

---

## Validation

- Commands to run:
  - `cd /Users/kimgalant/dev/landlordguru/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-15
  - Outcome: All new split tests pass in isolation (10/10). Full suite (89 tx tests) has pre-existing cascade failures due to SSH tunnel latency (~325s total run time, 5s/test timeout). Logic is correct; infrastructure is the bottleneck.

---

## Files touched this session

- `version.json` — bumped to 2.22.0
- `docs/epics/03-transaction-management.md` — F3-17 marked Done
- `AI_STATE.md`
- `docs/ai_state_archive.json`

---

## Automation log (latest only)

- 2026-05-17 [F3-17 done — committing; F3-18 set as next focus]
  - branch: main
  - last_commit: c9a33b2
  - changed_files: AI_STATE.md, backend/src/routes/transactions.js, backend/tests/transactions.test.js, docs/ai_state_archive.json, frontend/css/datatable.css, frontend/css/style.css, frontend/index.html, frontend/js/api.js, frontend/js/app.js, frontend/js/datatable.js, frontend/js/strings.js, version.json, docs/epics/03-transaction-management.md, backend/src/db/migrations/022_transaction_splits.js
  - git_status: M AI_STATE.md, M backend/src/routes/transactions.js, M backend/tests/transactions.test.js, M docs/ai_state_archive.json, M frontend/css/datatable.css, M frontend/css/style.css, M frontend/index.html, M frontend/js/api.js, M frontend/js/app.js, M frontend/js/datatable.js, M frontend/js/strings.js, ?? backend/src/db/migrations/022_transaction_splits.js
