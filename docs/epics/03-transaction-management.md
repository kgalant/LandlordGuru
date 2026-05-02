# Epic 3 — Transaction Management

## Goal
Allow users to create, edit, categorise, and delete financial transactions. Support both manual entry and bulk import. Transactions are the core data of the application.

## Status
Planned. The `transactions` table exists in the schema. The backend API routes are not yet built. A CSV import pipeline exists in the frontend (`js/importer.js`) and will be migrated to the backend.

---

## Features

### F3-1 Transaction CRUD API `[MVP]`
**Status:** Done

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

**Non-base-currency transactions:** If `currency` differs from the workspace
`reporting_currency`, a valid rate must exist in `currency_rates` for the
transaction date (see F2-9). The API returns HTTP 422 if no rate is
resolvable. The resolved rate and converted amount are returned in the
response for client display.

---

### F3-2 Transaction list UI `[MVP]`
**Status:** Done

Frontend view showing transactions with filtering and sorting.

**Acceptance criteria:**
- Displays transactions from `GET /api/transactions`
- Columns: date, property, type, category, description, amount, currency
- Filter controls: property, type, date range
- Sortable by date (default: newest first) and amount
- Clicking a row opens an edit form (F3-1 PATCH)
- "Add transaction" button opens a new transaction form
- Bulk select + delete for removing imported rows
- In multi-currency workspaces, each row shows the native amount and
  currency; a workspace-level toggle displays the converted value in the
  reporting currency alongside the native value, using the dated rate from
  `currency_rates` current on the transaction date

---

### F3-3 Category validation `[MVP]`
**Status:** Done

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

### F3-4 Bulk CSV import endpoint `[MVP]`
**Status:** Done

Accept a parsed list of transactions from the frontend and insert them as a batch.

**Acceptance criteria:**
- `POST /api/transactions/import` — accepts an array of transaction objects
- All rows share a generated `import_batch` UUID (for rollback and audit)
- Each row is validated before any are inserted (all-or-nothing within a batch)
- Returns: count of rows inserted, the `import_batch` ID, and any validation errors per row
- Duplicate detection: before inserting, the endpoint (or a dedicated pre-check call — see F5-12) checks each incoming row against existing workspace transactions using the key `(property_id, date, raw_description, amount)`. The full UX spec — visual flagging, auto-ignore default, per-row hover detail, and check trigger logic — is in F5-12.
- `source` field is set from the bank profile name provided by the client

**Dependencies:** F5-1 (CSV parsing) produces the validated row array that this endpoint receives.

---

### F3-5 Import batch rollback `[MVP]`
**Status:** Done

Allow users to undo an entire import batch.

**Acceptance criteria:**
- `DELETE /api/transactions/import/:batch_id` — deletes all transactions with the given `import_batch`
- Only transactions in the current workspace can be deleted
- Returns count of rows deleted
- UI: import history shows recent batches with a "Undo import" action per batch

---

### F3-6 Reconciliation marking `[MVP]`
**Status:** Planned

Let users mark transactions as verified against a bank statement.

**Acceptance criteria:**
- `PATCH /api/transactions/:id` with `{ reconciled: true/false }` toggles the flag
- Reconciled transactions are visually distinct in the list UI
- A filter option shows only unreconciled transactions

---

### F3-8 Sticky and sortable column headers in transaction list `[MVP]`
**Status:** Backlog

Keep column headers visible while scrolling and allow sorting by any column.

**Acceptance criteria:**
- Column headers remain fixed at the top of the viewport when the user scrolls down through the transaction list.
- Clicking a column header sorts the list by that column; first click = ascending, second click on the same column = descending.
- Sortable columns: date, property, type, category, description, amount.
- The active sort column shows a directional indicator (e.g. `▲` / `▼`) in the header; all other columns show no indicator.
- Clicking a different column resets direction to ascending and clears the previous column's indicator.
- Current default sort (newest date first) is preserved as the initial state.

**Note:** The sort *logic* (date and amount) already exists from F3-2. This feature adds sticky positioning and per-column sort indicators for all columns.

---

### F3-9 Pagination in transaction list `[MVP]`
**Status:** Done

Show transactions in pages so large datasets don't hit the API's default limit.

**Acceptance criteria:**
- A page control bar appears below the transaction table showing current page, total pages, and prev/next buttons.
- Page number links are shown (e.g. 1 2 3 … 12) with the current page highlighted.
- A "rows per page" dropdown lets the user choose 10, 20, 50, or 100 transactions per page.
- The API is called with `page` and `limit` params matching the user's selection; no client-side slicing of a full result set.
- Total count comes from the API response (the backend already supports `page`/`limit` on `GET /api/transactions`).
- When filters change, the page resets to 1.
- The footer summary ("N transactions shown · Income: … · Expenses: …") reflects only the visible page, with a note of the total count when paginated.

---

### F3-12 Column management UI for transaction list `[MVP]`
**Status:** Backlog

A gear-icon button in the transaction list toolbar that opens a column management panel, allowing users to show/hide columns and save named views. Column visibility is coupled to filter bar visibility. Persisted via F1-11.

**Column management panel (opened by gear button):**
- Gear icon (⚙) button sits in the transaction list toolbar alongside existing filter controls
- Clicking opens a modal/panel listing all available columns with a checkbox per column (visible/hidden)
- Columns can be reordered by drag-and-drop (optional; may be deferred to a follow-up)
- Two save actions:
  - **Save** — overwrites the currently active named view with the new column selection
  - **Save as new view** — prompts for a name and creates a new named view (calls F1-11 POST); new view becomes active
- A dropdown at the top of the panel lists all saved views for this user; switching applies that view immediately and persists it as active
- **Rename** and **Delete** actions on non-default named views
- Closing the panel without saving discards unsaved changes

**Column-filter coupling:**
- Each column definition in the frontend column registry declares an optional `filterKey` — the ID of the filter control associated with that column
- When a column is hidden, its associated filter control is removed from the filter bar and its value is cleared
- When a column is made visible, its filter control reappears in the filter bar
- This rule applies at initial page load (columns and filters both reflect the active saved view) and whenever the user changes the active view
- **Forward-compatible:** adding a new column to the transaction data model requires registering it in the column registry with a `key`, `label`, `defaultVisible` flag, and optional `filterKey`; no other code changes are needed to participate in column management

**Column registry (initial columns for `transactions` view):**

| key | label | defaultVisible | filterKey |
|-----|-------|---------------|-----------|
| `date` | Date | true | `filter_date` |
| `account` | Account | true | `filter_account` |
| `type` | Type | true | `filter_type` |
| `category` | Category | true | `filter_category` |
| `description` | Description | true | — |
| `amount` | Amount | true | — |
| `currency` | Currency | true | — |
| `source` | Source | false | — |
| `reconciled` | Reconciled | false | `filter_reconciled` |

**Persistence:**
- On page load, calls `GET /api/user/view-configs/transactions`; applies the active view's column config
- On save, calls `POST` or `PATCH /api/user/view-configs/transactions`
- If the API returns no saved config, the synthetic default (all columns at `defaultVisible`) is applied without writing a row

**Dependencies:** F1-11 (view config API), F3-2 (transaction list host)

---

### F3-10 Transaction edit modal with source-field override tracking `[MVP]`
**Status:** Backlog

Edit any field on a transaction via a modal, and preserve the original import values for source-data fields (date, description, amount) so users can see what was changed from the imported data.

**Acceptance criteria:**

**Edit modal:**
- Clicking a transaction row opens an edit modal showing all editable fields: date, account, type, category, amount, currency, description, notes
- All fields are editable; saving calls `PATCH /api/transactions/:id`
- Type/category changes are validated against the F3-3 taxonomy rules
- Modal shows a "Cancel" and a "Save" button; unsaved changes prompt for confirmation on dismiss

**Source-field override tracking:**
- Source fields are: `date`, `description`, `amount` — values that originally came from import or entry
- `raw_description` (existing column) already stores the original description; no new column needed for description
- Two new nullable columns are added to the `transactions` table: `original_date` (date) and `original_amount` (numeric)
  - Each is set to the field's current value the **first time** a user changes it; null means the field has never been overridden
  - Once set, these columns are never overwritten — they permanently record the as-imported value
- In the UI, when an override is present, display the original value in small muted text directly below the current value in the modal (and optionally in the list row)
  - `description`: shown when `raw_description` is non-null and differs from `description`
  - `date`: shown when `original_date` is non-null
  - `amount`: shown when `original_amount` is non-null
- `PATCH /api/transactions/:id` accepts `original_date` and `original_amount` and persists them (ignored if already set)

**Schema change:** New migration adding `original_date` (nullable date) and `original_amount` (nullable numeric) to the `transactions` table.

**Non-goals (out of scope for this feature):**
- Full edit history / audit log of every change
- Bulk edit
- Reverting source fields back to original (can be added later)

**Dependencies:** F3-1 (PATCH endpoint), F3-2 (list UI host)

---

### F3-11 Year quick-select in transaction list filter `[MVP]`
**Status:** Backlog

Add a year dropdown to the transaction filter bar, mirroring the equivalent control in the reports view (F4-9).

**Acceptance criteria:**
- A "Year" dropdown appears in the filter bar alongside the existing property, type, and date-range controls
- Default / blank option = "All years" — no year filter is applied; all transactions within other active filters are shown
- Selecting a year restricts results to transactions whose `date` falls within that calendar year
- The year list is derived from the years present in the workspace's transactions (no hardcoded range)
- When a year is selected alongside an explicit date-range filter, the date-range takes precedence (or the year control is disabled while a date range is active — either is acceptable; implement whichever is simpler)
- When filters change, pagination resets to page 1 (aligns with F3-9)
- The API call passes `from` / `to` date params derived from the selected year (e.g. `from=2024-01-01&to=2024-12-31`)

**Dependencies:** F3-2 (filter bar host), F3-1 (`from`/`to` query params already supported)

---

### F3-7 Tenant linking on transactions `[Future]`
**Status:** Future

Optionally associate a transaction with a specific tenant (when tenant tracking is enabled).

**Acceptance criteria:**
- Transactions can carry a `tenant_id` FK (nullable)
- Unlinked transactions remain valid at all times
- When tenant tracking is not enabled in a workspace, the field is hidden in the UI
- No requirement to retroactively tag existing transactions

**Dependencies:** F2-5 (tenant and lease management).

---

## Bugs

### B3-2-2 Bulk delete button stays visible after table re-render, then does nothing
**Status:** Fixed
**Feature:** F3-2 Transaction list UI
**Symptom:** User checks transactions, then changes a filter (or any action that calls `renderTxTable()`). The "Delete selected" count/button stays visible even though the table was re-rendered with fresh, unchecked checkboxes. Clicking "Delete selected" silently does nothing.
**Root cause:** `renderTxTable()` replaces `tbody.innerHTML`, destroying all checkboxes. It never calls `onTxRowSelect()` afterwards, so the bulk bar retains its previous `display:flex` state. `bulkDeleteTx()` queries `.tx-row-cb:checked`, finds zero, and returns early with no feedback.
**Fix:** Call `onTxRowSelect()` at the end of `renderTxTable()` so the bulk bar always reflects actual checkbox state. Also changed the silent early-return on empty selection to show a toast.

---

### B3-2-1 Transaction footer shows garbled concatenated amounts
**Status:** Fixed  
**Feature:** F3-2 Transaction list UI  
**Symptom:** Footer shows e.g. `Income: 016700.0016700.00…` — amounts concatenated as strings instead of summed as numbers.  
**Root cause:** PostgreSQL's `NUMERIC` type is returned as a string by `node-postgres`. The footer `reduce((s, tx) => s + tx.amount, 0)` string-concatenates rather than adds. Multiplication elsewhere coerces silently; plain `+` does not.  
**Fix:** Parse `tx.amount` to `parseFloat` when `State.transactions` is assigned, so all consumers receive a number.

---

## Dependencies
- `transactions` table (created in M2 migrations)
- Auth middleware (M3)
- Properties API (F2-1) — needed to associate transactions with properties
- CSV import pipeline (F5-1) feeds into F3-4

## Notes
- The frontend's `js/importer.js` contains the existing CSV parsing logic. It will stay client-side (parsing step only), with the resulting row array sent to `POST /api/transactions/import`.
- `transfer` / `inter_account` transactions are excluded from P&L reporting by convention.
