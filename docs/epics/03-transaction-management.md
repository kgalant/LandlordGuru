# Epic 3 — Transaction Management

## Goal
Allow users to create, edit, categorise, and delete financial transactions. Support both manual entry and bulk import. Transactions are the core data of the application.

## Status
Planned. The `transactions` table exists in the schema. The backend API routes are not yet built. A CSV import pipeline exists in the frontend (`js/importer.js`) and will be migrated to the backend.

---

## Features

### 3.1 Transaction CRUD API `[MVP]`
Backend REST endpoints for reading and writing transactions.

**Acceptance criteria:**
- `GET /api/transactions` — returns transactions for the workspace; supports query params:
  - `account_id` — filter by account
  - `property_id` — filter by property (resolved via account_properties join)
  - `type` — filter by transaction type (`income`, `expense`, `deposit`, `transfer`)
  - `category` — filter by category
  - `from` / `to` — date range (ISO 8601)
  - `page` / `limit` — pagination
- `POST /api/transactions` — creates a single transaction; required: `date`, `type`, `category`, `amount`, `currency`
- `PATCH /api/transactions/:id` — updates any field; `workspace_id` cannot be changed
- `DELETE /api/transactions/:id` — hard delete (transactions are user data; no soft delete needed)
- All routes require authentication; `workspace_id` is injected from JWT
- `created_by` and `last_modified_by` are stamped from `req.user.id`

**Fields (see `docs/data-model.md` for full schema):**
`date`, `account_id`, `type`, `category`, `amount`, `currency`, `description`, `raw_description`, `source`, `import_batch`, `notes`, `reconciled`

**Sign convention:** `amount` is always positive. Sign is encoded in `type`/`category`.

---

### 3.2 Transaction list UI `[MVP]`
Frontend view showing transactions with filtering and sorting.

**Acceptance criteria:**
- Displays transactions from `GET /api/transactions`
- Columns: date, property, type, category, description, amount, currency
- Filter controls: property, type, date range
- Sortable by date (default: newest first) and amount
- Clicking a row opens an edit form (3.1 PATCH)
- "Add transaction" button opens a new transaction form
- Bulk select + delete for removing imported rows

---

### 3.3 Category validation `[MVP]`
Enforce the category taxonomy on the backend.

**Acceptance criteria:**
- `type` must be one of: `income`, `expense`, `deposit`, `transfer`
- `category` must be valid for the given `type` (see taxonomy in `docs/data-model.md`)
- Invalid combinations return HTTP 422 with a descriptive error message
- `notes` is required when `category` is `other_expense`

**Category taxonomy (summary):**

| type | valid categories |
|------|-----------------|
| income | `rent`, `heating_aconto`, `heating_settlement` |
| expense | `maintenance_repair`, `property_tax`, `insurance`, `utilities`, `management_fee`, `advertising`, `professional_fees`, `bank_charges`, `other_expense` |
| deposit | `deposit_received`, `deposit_returned` |
| transfer | `inter_account` |

---

### 3.4 Bulk CSV import endpoint `[MVP]`
Accept a parsed list of transactions from the frontend and insert them as a batch.

**Acceptance criteria:**
- `POST /api/transactions/import` — accepts an array of transaction objects
- All rows share a generated `import_batch` UUID (for rollback and audit)
- Each row is validated before any are inserted (all-or-nothing within a batch)
- Returns: count of rows inserted, the `import_batch` ID, and any validation errors per row
- Duplicate detection: rows with identical `(date, amount, raw_description, property_id)` within the same workspace are flagged (not blocked — user decides)
- `source` field is set from the bank profile name provided by the client

**Dependencies:** Epic 5 (CSV parsing) produces the validated row array that this endpoint receives.

---

### 3.5 Import batch rollback `[MVP]`
Allow users to undo an entire import batch.

**Acceptance criteria:**
- `DELETE /api/transactions/import/:batch_id` — deletes all transactions with the given `import_batch`
- Only transactions in the current workspace can be deleted
- Returns count of rows deleted
- UI: import history shows recent batches with a "Undo import" action per batch

---

### 3.6 Reconciliation marking `[MVP]`
Let users mark transactions as verified against a bank statement.

**Acceptance criteria:**
- `PATCH /api/transactions/:id` with `{ reconciled: true/false }` toggles the flag
- Reconciled transactions are visually distinct in the list UI
- A filter option shows only unreconciled transactions

---

### 3.7 Tenant linking on transactions `[Future]`
Optionally associate a transaction with a specific tenant (when tenant tracking is enabled).

**Acceptance criteria:**
- Transactions can carry a `tenant_id` FK (nullable)
- Unlinked transactions remain valid at all times
- When tenant tracking is not enabled in a workspace, the field is hidden in the UI
- No requirement to retroactively tag existing transactions

**Dependencies:** Epic 2 feature 2.5 (tenant and lease management).

---

## Dependencies
- `transactions` table (created in M2 migrations)
- Auth middleware (M3)
- Properties API (Epic 2, feature 2.1) — needed to associate transactions with properties
- CSV import pipeline (Epic 5) feeds into 3.4

## Notes
- The frontend's `js/importer.js` contains the existing CSV parsing logic. It will move to the client-side only (parsing step), with the resulting row array sent to `POST /api/transactions/import`.
- `transfer` / `inter_account` transactions are excluded from P&L reporting by convention.
