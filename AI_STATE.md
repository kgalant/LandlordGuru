# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E1 Workspace and User Management
- ID: F1-9b
- Title: Category labels, per-workspace built-in overrides, and active/inactive toggle
- Short summary: Add separate label (display name) and code (immutable slug) to transaction categories; per-workspace label and active/inactive overrides for built-ins via a new override table; edit-label button on all categories; UI always shows label.

---

## Previous focus

None.

---

## Task breakdown (current focus)

- [x] F1-9b-1: DB migration — add `label` to `workspace_enum_values` with seeded built-in labels; create `workspace_enum_overrides` table
- [x] F1-9b-2: Backend GET — resolve effective label and is_active (override for built-ins, direct for custom); add `?include_inactive=true` support
- [x] F1-9b-3: Backend POST — accept `label` param; keep `value` (code) lowercase slug
- [x] F1-9b-4: Backend PATCH — new endpoint `PATCH /api/workspace/enums/transaction-categories/:id`; accepts `{ label?, is_active? }`; upserts override for built-ins, updates row for custom
- [x] F1-9b-5: Frontend api.js — add `updateTransactionCategory(id, data)` and `getTransactionCategoriesAll()` calls
- [x] F1-9b-6: Frontend add-form — two fields: Label (free text) + Code (lowercase slug, auto-derived from label but editable); uniqueness error shown on 409
- [x] F1-9b-7: Frontend category list — show label + code (secondary text); Edit button (all); Active toggle (all); Delete button (custom only)
- [x] F1-9b-8: Frontend edit-label inline form — editable label, read-only code
- [x] F1-9b-9: `catLabel()` wrapper + `Reports.categoryLabel()` — uses API-fetched label from State.transactionCategories; falls back to i18n

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Known bugs: F7-B1 (property column sorts by ID not name — needs properties join in transactions API)
- Backlog chores: F6-7 (consolidate version numbering — three files, two are authoritative, root version.json appears unused)
- Backlog features: F1-11, F1-12, F3-8, F3-10, F3-11, F3-12, F5-9, F5-10, F5-11 (polish/UX, low priority)
- Next MVP candidates (Wave 3): F2-2, F2-6, F2-7
- Frontend architecture: F7-1 through F7-5 (DataTable component + migrations)

Relevant epic docs:

- `docs/epics/01-workspace-user-management.md` (E1)
- `docs/epics/02-account-property-management.md` (E2)
- `docs/epics/03-transaction-management.md`      (E3)
- `docs/epics/04-reporting-analytics.md`         (E4)
- `docs/epics/05-integrations-data-import.md`    (E5)
- `docs/epics/06-architecture-backend.md`        (E6)
- `docs/epics/07-frontend-architecture.md`       (E7)

---

## Next step

All F1-9b subtasks done. Smoke-test the categories UI in the browser: add a category (check label + code), edit a built-in label, deactivate a built-in, then confirm the import preview dropdown reflects labels. Commit when verified.

---

## Validation

- Commands to run:
  - `cd /home/kim/dev/landlordguru-dev/backend && node_modules/.bin/jest --forceExit`

- Last result:
  - Date/time: 2026-04-30
  - Outcome: 192/192 tests passing (8 new PATCH tests added). Frontend not yet smoke-tested.

---

## Files touched this session

- `AI_STATE.md`
- `docs/epics/01-workspace-user-management.md`
- `backend/src/db/migrations/017_enum_labels_and_overrides.js`
- `backend/src/routes/workspace.js`
- `backend/tests/workspace.test.js`
- `frontend/js/api.js`
- `frontend/js/app.js`
- `frontend/js/reports.js`
- `frontend/js/importer.js`
- `frontend/index.html`

---

## Automation log (latest only)

- 2026-04-30 [F1-9b spec added, set as current focus]
  - branch: main
  - last_commit: 57e291c
  - changed_files: AI_STATE.md, docs/epics/01-workspace-user-management.md
  - git_status: clean (spec only, no code yet)
