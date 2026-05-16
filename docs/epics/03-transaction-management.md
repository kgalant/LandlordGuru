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
**Status:** Done

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
**Status:** Done

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
**Status:** Done

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

### F3-13 Group-by in transaction list `[MVP]`
**Status:** Backlog

Add a "Group by" dropdown to the transaction list toolbar, allowing the user to group rows by up to two column dimensions (e.g. Property → Category). Groups are collapsible and show summed currency values.

**Acceptance criteria:**

**Dropdown UI:**
- A "Group by" button/dropdown sits in the toolbar alongside the Columns ⚙ control
- The dropdown lists groupable columns: Property, Type, Category, Account
- The user selects up to 2 columns; selected columns appear as ordered chips (e.g. "Property → Category")
- Selecting the same column twice is disallowed
- Clearing all selections returns to the flat list

**Grouped table layout:**
- When one level is active: rows are grouped under a group header row showing the group value and row count (e.g. "Elm Street (12 transactions)")
- When two levels are active: first-level group headers contain second-level group headers, which in turn contain data rows
- Group header rows span the full table width; they are visually distinct from data rows

**Collapsing:**
- Clicking a group header row toggles that group collapsed/expanded
- Collapsed state is local to the session (not persisted)
- All groups start expanded

**Empty groups:**
- Groups with no transactions (after active filters applied) are not rendered at all

**Currency sums:**
- The Amount column in each group header row shows the sum of all transaction amounts within that group
- At two levels deep, the inner group shows its own sum; the outer group shows the total across all inner groups

**Interaction with filters:**
- Group-by respects all active filter controls; only filtered-in transactions contribute to groups
- When a grouping column is hidden (F3-12 column management), it is removed from the Group by selection and the grouping re-renders

**Dependencies:** F3-2 (list host), F7-1 (DataTable — may need internal extension for group-row rendering)

---

### F3-14 Year filter multi-select with contiguous validation `[Post-MVP]`
**Status:** Backlog  
**Supersedes:** F3-11 (year quick-select, single-select — now extended to multi-select)

Upgrade the year dropdown from single-select to multi-select. Multiple years pre-fill the date range spanning the selected years. Non-contiguous selections are rejected with a toast.

**Acceptance criteria:**
- Year dropdown renders as a multi-select (checkboxes per year option)
- Selecting multiple contiguous years (e.g. 2024 + 2025) sets `from=2024-01-01, to=2025-12-31`
- On each toggle, the resulting selection is checked for contiguity: if any year in the gap between min and max is not selected, the toggle is reverted and a toast is shown: "Years selected must be contiguous"
- "All years" (blank / clear all) remains available
- When a date-range filter is also active, date-range takes precedence over the year selection (consistent with F3-11)
- Pagination resets to page 1 on any change (consistent with F3-9)

**Dependencies:** F3-2 (filter bar host), F3-11 (prior implementation to replace)

---

### F3-15 Multi-select filters for Property, Category, and Type `[Post-MVP]`
**Status:** Backlog

Upgrade the Property, Category, and Type filter controls from single-select to multi-select dropdowns. Requires a new `multi-select` filter type in the DataTable component (F7-1 extension) and backend API changes to accept multiple values.

**Acceptance criteria:**

**UI:**
- Property, Category, and Type filter controls become multi-select dropdowns (checkbox list per control)
- When one or more values are selected, the control shows a compact label, e.g. "Type (2)" or "Maintenance, Utilities"
- Empty selection = no filter applied (same as current "All" behaviour)
- "Select all" / "Clear all" shortcuts in each dropdown

**Backend changes:**
- `GET /api/transactions` accepts multi-value params for `type`, `category`, and `property_id`
  - Accepted as repeated params (`?type=income&type=expense`) or comma-separated (`?type=income,expense`)
  - When multiple values given, `WHERE type = ANY(...)` (or equivalent)
- Existing single-value usage remains backward-compatible

**DataTable extension (F7-1):**
- New filter type `'multi-select'` in the column definition `filter.type` field
- Renders as a dropdown with one checkbox per option
- Passes selected values as an array through `fetchData` params
- When column is hidden, multi-select value clears (same as existing single-select behaviour)

**Interaction with group-by (F3-13):**
- Group-by respects multi-select filters; groups only contain filtered-in transactions

**Dependencies:** F3-1 (API), F3-2 (filter bar host), F7-1 (DataTable multi-select extension)

---

### F3-16 Filter description tooltip `[Post-MVP]`
**Status:** Backlog

Display a concise verbal summary of the active filter state as a tooltip/popover, so users can quickly understand what is being shown without reading each individual control.

**Acceptance criteria:**
- A small info badge (ⓘ) appears in the filter bar when at least one filter has a non-default value
- The badge is hidden when no filters are active
- Hovering the badge shows a tooltip/popover with a natural-language summary of all active filters, e.g.:
  > Showing transactions for Properties: Elm St, Oak Ave · Date: 1 Jan – 31 Dec 2025 · Type: Expense · Categories: Maintenance, Utilities
- Only filters with active (non-empty) values are included in the summary
- The tooltip reads from live DataTable filter state — no API call; updates as filters change
- The tooltip dismisses on mouse-out

**Dependencies:** F3-2 (filter bar host), F7-1 (DataTable filter state access)

---

### F3-17 Transaction splitting `[MVP]`
**Status:** Done

Allow a single bank transaction (e.g. a combined rent + utilities payment) to be split into two or more child transactions with individual types, categories, and amounts. The children replace the parent in all reporting and aggregation; the parent is retained as a permanent reference to the original bank entry. No double-counting is possible by design.

**Data model:**

- New nullable column on `transactions`: `parent_transaction_id` (FK → `transactions.id`, `ON DELETE CASCADE`)
- Constraint: `parent_transaction_id` must be `NULL` if the transaction already has children (max depth = 1; children cannot themselves be split)
- Constraint: the sum of all direct children's `amount` values must equal the parent's `amount`; same `currency` required
- Children inherit `date`, `account_id`, `property` (via account), `import_batch`, `currency`, and `source` from the parent; they can have independent `type`, `category`, `description`, `notes`, and `amount`

**Aggregation and reporting rule:**

> A transaction is a **split parent** if any row exists with `parent_transaction_id = that transaction's id`.  
> All aggregations (footer totals, P&L reports, group-by sums) must **exclude split parents** and **include children**.

The query pattern for all aggregate reads:
```sql
WHERE id NOT IN (
  SELECT DISTINCT parent_transaction_id
  FROM transactions
  WHERE parent_transaction_id IS NOT NULL
    AND workspace_id = $workspace_id
)
```
This naturally handles the normal case (no children → not excluded) and the split case (children exist → parent excluded).

**Transaction list display:**
- Split parents remain visible in the list with a "Split" badge in the description column
- Their amounts are visually muted (grey) to signal they are not counted
- Each child appears as its own row in the list with its own type/category/amount
- Children optionally show a subtle "↳" or "part of" indicator linking back to the parent
- The footer total and all aggregations follow the rule above (parent excluded when children exist)

**Transaction edit modal — split UI:**
- In the edit modal for any transaction that has no parent, a "Split transaction" button is available at the bottom
- Clicking it expands an inline split editor showing:
  - The **total** (fixed; same as parent amount — cannot be changed while splits exist)
  - A rows table: each row has `type`, `category`, `description`, `amount`; pre-populated with one row matching the parent
  - An "Add row" button adds a new blank split row
  - A running **remaining** counter shows `total − sum(rows so far)`; turns red if non-zero
  - A "Fill remaining" shortcut on the last row sets its amount to the remaining balance
  - A "Remove splits" action deletes all children and returns the parent to leaf status (with a confirmation prompt)
- The modal **Save** button is disabled (and shows a tooltip) until all split rows sum exactly to the parent amount
- Saving calls a new endpoint (see below) to replace any existing children atomically

**API changes:**
- `PUT /api/transactions/:id/splits` — body: array of `{ type, category, description, amount, notes? }`
  - Validates: all amounts positive, sum === parent amount, same currency, parent not itself a child
  - Atomically deletes all existing children then inserts the new set
  - Returns the parent and new children
- `DELETE /api/transactions/:id/splits` — removes all children, reverting parent to leaf status
- `GET /api/transactions` and `GET /api/transactions/:id` responses include `split_count: N` (0 for non-split parents and all children) and `parent_transaction_id` for children
- All existing aggregation endpoints (`GET /api/reports/*`, transaction footer totals) apply the exclusion rule

**Schema change:** New migration adding `parent_transaction_id` (nullable FK with `ON DELETE CASCADE`) to the `transactions` table.

**Bulk-apply to similar transactions:**
- After saving a split, a secondary action appears: "Apply this split to similar transactions"
- "Similar" is defined as: same `account_id` AND same `amount` AND `parent_transaction_id IS NULL` (not already split)
- The user is shown a preview list of all matching unsplit transactions (date, description, count)
- Confirming applies the same split template to all of them atomically (one `PUT /api/transactions/:id/splits` call per match, or a batch endpoint)
- Individual transactions can be deselected from the preview before confirming

**Non-goals (out of scope):**
- Multi-level splitting (children splitting further)
- Partial splits (children summing to less than parent) — not permitted
- Splitting an already-split child (not permitted)

**Dependencies:** F3-1 (PATCH endpoint), F3-2 (list UI), F3-10 (edit modal host)

---

### F3-18 Split rules (auto-split at import) `[MVP]`
**Status:** Backlog

Allow users to define split rules that automatically split matching transactions during import. A split rule is a combination of match conditions (same pattern as categorisation rules in F5-3) and a reusable split template (the child allocations). When an imported transaction matches a rule, it is immediately split without manual intervention. Rules can also be created directly from a manual split via a "Save as rule" shortcut in the split editor.

**Data model:**

- `split_rules` table: `id`, `workspace_id`, `name` (user label), `enabled` (boolean), `conditions` (JSONB), `template` (JSONB), `created_at`, `created_by`
- `conditions`: array of `{ field, operator, value }` — same schema as F6-4 tagging rules; AND logic within a rule
  - Available fields: `account_id` (equals), `amount` (equals / greater_than / less_than), `description` (contains / equals)
- `template`: array of `{ type, category, description, amount_type, amount_value }`
  - `amount_type`: `'fixed'` (absolute amount in parent currency) or `'percent'` (percentage of parent)
  - Within a single rule all template rows must use the same `amount_type`
  - Validation at save time: fixed rows must sum to the expected parent amount (only enforceable at runtime for variable-amount parents using percent mode); percent rows must sum to exactly 100
- `split_rules` are workspace-scoped, ordered by `created_at` (first matching rule wins)

**Split rule UI (reusable form component):**
- The rule creation/edit form is a single reusable component used in two contexts (see below):
  - **Fields:** name, condition builder (field + operator + value rows, add/remove row), split template rows (type + category + description + amount_type/value, add/remove row), fixed-vs-percent mode toggle (one mode per rule), enable/disable toggle
  - Fixed-amount vs. percent-amount mode is selected once per rule; switching mode resets all template row amounts
- **Context 1 — standalone management section:** Managed alongside or adjacent to the categorisation rules table (F5-3); lists all workspace split rules with create/edit/delete/enable-disable actions
- **Context 2 — "Save as rule" from the split editor:** After saving a manual split in the edit modal (F3-17), a secondary action "Save as split rule" is available alongside "Apply to similar"
  - Clicking opens the rule form in a modal, pre-populated:
    - **Template:** the split rows just saved (types, categories, descriptions, amounts); `amount_type` defaults to `fixed`; user can switch to `percent` (amounts recalculate as percentages of parent amount)
    - **Conditions:** pre-filled with `account_id` equals this transaction's account and `amount` equals this transaction's amount; user can add, remove, or edit conditions before saving
  - Saving creates the rule and confirms with a toast; the form is the same component as the standalone view — no separate implementation

**Import pipeline integration:**
- Split rule evaluation runs after categorisation rules (F5-3) have been applied to each row
- For each row, the first matching enabled split rule is applied: the row's `amount` is used to compute child amounts (for `'fixed'` rules this is a direct copy; for `'percent'` rules each child amount = `parent_amount × percent / 100`, rounded to 2 decimal places with any rounding remainder added to the last child)
- If a split rule matches, the imported transaction is saved as a split parent with its children; the import preview shows these rows with an "Auto-split" badge and expandable child rows
- If no split rule matches, the transaction imports as a single leaf transaction (normal behaviour)

**Non-goals (out of scope for this feature):**
- Retroactive application of rules to existing transactions — see F3-19

**Dependencies:** F3-17 (split data model and `PUT /api/transactions/:id/splits` endpoint), F5-3 (import rules pipeline — split rule evaluation runs in the same pass)

---

### F3-19 Retroactive split rule application `[Post-MVP]`
**Status:** Backlog

Re-evaluate split rules against existing unsplit transactions so users can apply rules created after past imports.

**Acceptance criteria:**
- A "Apply split rules to existing transactions" action appears in the split rules management section
- Clicking shows a preview: list of all unsplit leaf transactions in the workspace that match at least one enabled split rule, grouped by matching rule, showing date, description, amount, and which rule would apply
- Individual transactions can be deselected from the preview before confirming
- Confirming applies each matching rule atomically (one `PUT /api/transactions/:id/splits` call per transaction, or a batch endpoint)
- A summary toast confirms how many transactions were split

**Dependencies:** F3-18 (split rules data model, CRUD API, and rule evaluation logic)

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
- F3-15 (multi-select filters) requires a DataTable extension — see F7-1 in `07-frontend-architecture.md`
- F3-15 and F6-5 (tag filter) are complementary multi-select upgrades; implement together if practical

## Notes
- The frontend's `js/importer.js` contains the existing CSV parsing logic. It will stay client-side (parsing step only), with the resulting row array sent to `POST /api/transactions/import`.
- `transfer` / `inter_account` transactions are excluded from P&L reporting by convention.
