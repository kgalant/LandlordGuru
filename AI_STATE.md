# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-18
- Title: Split rules (auto-split at import)
- Short summary: Rules that auto-split matching transactions during import. New `split_rules` table + CRUD API. Reusable rule form used in standalone management section AND as "Save as rule" shortcut from the manual split editor. Import pipeline evaluates rules per-row after categorisation. F3-19 (retroactive apply) parked as separate post-MVP feature.

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
- [ ] S3: Backend — import pipeline integration: evaluate rules per-row after categorisation, apply first matching rule, return `auto_split` flag in import preview response
- [ ] S4: Tests — CRUD + rule evaluation + percent/fixed rounding + sum/100 validation
- [ ] S5: Frontend — reusable rule form component (condition builder, template rows, fixed/percent toggle, enable/disable); standalone management section listing all workspace rules
- [ ] S6: Frontend — import preview: "Auto-split" badge + expandable child rows for auto-split transactions
- [ ] S7: Frontend — "Save as rule" secondary action in split editor: opens reusable rule form pre-populated from the just-saved split template and transaction conditions

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F3-8, F3-12, F3-13, F3-18, F4-1+F4-2, F5-7
- Post-MVP backlog added: F3-14 (year multi-select), F3-15 (multi-select filters), F3-16 (filter tooltip), F3-19 (retroactive split rule apply), E6 (tags & rules)

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

Start S1: write DB migration `023_split_rules.js` creating the `split_rules` table with `id`, `workspace_id`, `name`, `enabled`, `conditions` (JSONB), `template` (JSONB), `created_at`, `created_by`.

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
- `docs/epics/03-transaction-management.md` — F3-17 marked Done; F3-18 spec revised (retroactive apply removed, "Save as rule" added); F3-19 spec added
- `AI_STATE.md`
- `docs/ai_state_archive.json`

---

## Automation log (latest only)

- 2026-05-17 [F3-17 committed b80bf88; F3-18 spec finalised; F3-19 added]
  - branch: main
  - last_commit: b80bf88
  - changed_files: AI_STATE.md, docs/ai_state_archive.json, docs/epics/03-transaction-management.md
  - git_status: M AI_STATE.md, M docs/ai_state_archive.json, M docs/epics/03-transaction-management.md
