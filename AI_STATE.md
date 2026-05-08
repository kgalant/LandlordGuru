# AI State

## Goal

Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## Current focus

- Type: feature
- Epic: E2 Account and Property Management
- ID: F2-6
- Title: Account hierarchy management UI
- Short summary: Build the frontend UI for managing the account tree (add, edit, re-parent, set default, delete with reassignment). Includes migration 010 to seed missing default accounts and per-property accounts for existing data.

---

## Previous focus

None

---

## Task breakdown (current focus)

- [x] S1: Migration 021 — seed default account per workspace (where missing), create + link per-property accounts (where missing), assign NULL account_id transactions to the workspace default account
- [x] S2: Add "Accounts" nav button, page div, and `showPage()` routing to index.html + app.js
- [x] S3: Add API client methods (`getAccounts`, `getAccount`, `createAccount`, `updateAccount`, `deleteAccount`, `setDefaultAccount`); fetch and render account tree with archived section
- [x] S4: "Add account" form — name + parent dropdown + client-side depth validation + `POST /api/accounts`
- [x] S5: "Edit account" form — name, notes, re-parent dropdown + `PATCH /api/accounts/:id`
- [x] S6: "Set as default" action — confirmation prompt + `POST /api/accounts/:id/set-default`
- [x] S7: Extended `GET /api/accounts/:id` with `transaction_count`/`property_count`; "Delete account" — reassignment picker with counts + `DELETE /api/accounts/:id`
- [x] S8: i18n strings, test additions (linked counts), epic doc update, version bump (2.20.1 → 2.21.0)

---

## Backlog pointers

**For the complete MVP feature ordering and dependency graph, see `docs/roadmap.md`.**

- Backlog chores: F6-7 (consolidate version numbering)
- Backlog features: F1-11, F3-8, F3-12
- Next MVP candidates: F2-7, F3-8, F3-12, F3-13, F3-17, F3-18, F4-1+F4-2, F5-7
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

Confirm commit for F2-6 with user, then decide next focus (F2-7 or another MVP candidate).

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
- `backend/src/db/migrations/021_seed_default_accounts.js`
- `backend/src/routes/accounts.js`
- `backend/tests/accounts.test.js`
- `frontend/index.html`
- `frontend/js/app.js`
- `frontend/js/api.js`
- `frontend/js/strings.js`
- `frontend/css/style.css`
- `docs/epics/02-account-property-management.md`
- `version.json`

---

## Automation log (latest only)

- 2026-05-08 [F2-6 implementation complete — pending commit]
  - branch: main
  - last_commit: f208261
  - changed_files: AI_STATE.md, backend/src/db/migrations/021_seed_default_accounts.js, backend/src/routes/accounts.js, backend/tests/accounts.test.js, frontend/index.html, frontend/js/app.js, frontend/js/api.js, frontend/js/strings.js, frontend/css/style.css, docs/epics/02-account-property-management.md, version.json, docs/ai_state_archive.json
  - git_status: M (multiple files, pre-commit)
