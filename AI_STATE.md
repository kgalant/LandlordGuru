# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: bug
- Epic: E5 Integrations
- ID: F5-import-undo-fix
- Title: Undo import — history splits batches by source, modal shows wrong count
- Short summary: Done — GROUP BY import_batch only; MIN(created_by) dropped (UUID type incompatibility). All commits landed.

---

## Previous focus

- Type: feature
- Epic: E3 Transaction Management
- ID: F3-10
- Title: Transaction edit modal with source-field override tracking
- Short summary: Done — migration 020 (original_date, original_amount), backend PATCH guard, currency field added to modal, override hints shown under date/amount/description, saveTxModal sends originals on first change.
- State: done

---

## Task breakdown (current focus)

- [x] S1: Fix import history GROUP BY — only group by import_batch; aggregate source/created_by with MIN (transactions.js). Commit.

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
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

Pick next focus from MVP candidates (F2-6, F2-7, F3-8, F3-13, F3-17, F3-18, F4-1+F4-2, F5-7) — consult `docs/roadmap.md` and confirm with user.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-05-03
  - Outcome: 236/236 tests passing.

---

## Files touched this session

- `AI_STATE.md`
- `docs/ai_state_archive.json`
- `docs/epics/03-transaction-management.md` (added F3-13 through F3-18)
- `docs/epics/06-tags-rules.md` (new — E6 skeleton: F6-1 through F6-6)
- `docs/epics/07-frontend-architecture.md` (F7-1: noted planned multi-select filter type)

---

## Automation log (latest only)

- 2026-05-03 17:00:00 [cleanup]
  - branch: main
  - last_commit: dd1a398
  - changed_files: AI_STATE.md, docs/ai_state_archive.json, docs/epics/03-transaction-management.md, docs/epics/06-tags-rules.md, docs/epics/07-frontend-architecture.md
  - git_status: M AI_STATE.md, M docs/epics/03-transaction-management.md, M docs/epics/07-frontend-architecture.md, ?? docs/epics/06-tags-rules.md
