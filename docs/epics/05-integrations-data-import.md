# Epic 5 — Integrations and Data Import

## Goal
Make bulk import of bank transaction exports a first-class, low-friction workflow. Support multiple bank CSV formats, column mapping, and auto-categorisation rules.

## Status
Partially done. The frontend (`js/importer.js`) contains a complete CSV parsing pipeline with column mapping and bank profiles. This logic stays client-side. What's missing is the backend-side rules API and the import endpoint (covered in Epic 3, feature F3-4).

---

## Background

The import pipeline is intentionally split:

1. **Client-side (done):** CSV parsing, column mapping, date/amount parsing, bank profile detection, rule application, preview
2. **Server-side (planned):** Rules storage, bulk insert endpoint, duplicate detection, batch rollback

This split means users see a preview of all rows before anything is written to the database.

---

## Features

### F5-1 CSV parsing and column mapping `[MVP]`
**Status:** Done (frontend)

Parse a bank-exported CSV file and map its columns to transaction fields.

**Acceptance criteria:**
- Accepts CSV files with configurable delimiter (`,` or `;`)
- User maps columns to roles: Date / Description / Amount / Ignore
- Configurable: date format, decimal separator, rows to skip
- A mapping can be saved under a name and auto-applied when the same bank profile is detected
- Saved mappings are stored in `localStorage` under `lg_col_mappings_v1`
- Parsing errors (bad date, bad amount) are reported per-row; invalid rows are excluded from the preview

---

### F5-2 Bank profiles `[MVP]`
**Status:** Done (frontend)

Named presets for known bank export formats to reduce manual column mapping.

**Supported profiles (current):**

| Profile | Delimiter | Date format | Decimal | Skip rows |
|---------|-----------|-------------|---------|-----------|
| Jyske Bank (DK) | `;` | `DD.MM.YYYY` | `,` | 1 |
| Nordea DK | `;` | `DD.MM.YYYY` | `,` | 1 |
| mBank (PL) | `;` | `YYYY-MM-DD` | `,` | 1 |
| Generic CSV | `,` | `YYYY-MM-DD` | `.` | 0 |

**Acceptance criteria:**
- User selects a bank profile from a dropdown
- Profile pre-fills the column mapping panel
- User can still override any setting after selecting a profile
- New profiles can be added by updating the profile list in `js/importer.js`

---

### F5-3 Auto-categorisation rules `[MVP]`
**Status:** Done (backend)

Apply saved rules to automatically assign category and property to imported rows.

**Current state (frontend):**
- Rules are stored in the Google Sheet `rules` tab
- Applied client-side at import preview time
- First matching rule wins (evaluated in `sort_order`)

**Target state (backend):**
- Rules stored in the `rules` table in PostgreSQL
- Retrieved via `GET /api/rules` and applied client-side at preview time (same UX)
- Rules are created/edited via `POST/PATCH/DELETE /api/rules`

**Acceptance criteria:**
- `GET /api/rules` — returns all rules for the workspace, ordered by `sort_order`
- `POST /api/rules` — creates a rule; required: `keyword`, `category`; optional: `bank_profile`, `property_id`, `sort_order`
- `PATCH /api/rules/:id` — updates any field
- `DELETE /api/rules/:id` — removes a rule
- Rule matching: case-insensitive substring match of `keyword` against transaction `description`
- If `bank_profile` is set on a rule, it only applies when the import uses that profile
- Rules UI: list view with drag-to-reorder (updates `sort_order`)

---

### F5-4 Description mappings `[MVP]`
**Status:** Done

User-captured mappings from a specific description string to a category + property. Finer-grained than keyword rules.

**Current state:** Stored in `localStorage` under `lg_desc_mappings_v1`. Applied before rules during preview.

**Target state:** Persist to the backend so mappings survive device changes.

**Acceptance criteria:**
- `GET /api/description-mappings` — returns all mappings for the workspace/user
- `POST /api/description-mappings` — upsert by `(bank_profile, keyword)`
- `DELETE /api/description-mappings/:id`
- Composite unique key: `(workspace_id, bank_profile, user_id, keyword)`
- Priority at preview time:
  1. User-specific description mapping
  2. Global (workspace-wide) description mapping
  3. Auto-categorisation rules (F5-3)
  4. Default: `rent` if amount positive, `other_expense` if negative

---

### F5-5 Import preview `[MVP]`
**Status:** Done (frontend)

Show the user all parsed rows with their proposed category and property before committing.

**Acceptance criteria:**
- After CSV parsing and rule application, display a table of all rows
- Columns: date, description, amount, proposed category, proposed property
- Rows with errors (unparseable date/amount) are shown in red and excluded from the import
- User can override category and property per-row before importing
- "Import N rows" button submits the validated rows to `POST /api/transactions/import` (F3-4)
- Duplicate rows are detected, visually flagged, and defaulted to ignored — see F5-12 for the full spec (key, trigger logic, hover detail, and auto-ignore behaviour)
- Rows in a non-reporting currency are excluded from the importable set if no
  rate exists in `currency_rates` for the transaction date; a message
  identifies the missing rate and links to the rate management UI (F2-9)
  so the user can add the rate and re-import

---

### F5-6 Import history `[MVP]`
**Status:** Done

View and roll back previous import batches.

**Acceptance criteria:**
- UI section shows recent import batches: date of import, bank profile used, number of rows, user who imported
- Each batch has an "Undo" action that calls `DELETE /api/transactions/import/:batch_id` (F3-5)
- Undo is only available for the importing user or workspace owners
- After undo, the batch disappears from history

**Dependencies:** F3-5 (import batch rollback).

---

### F5-7 Import-time currency rate resolution `[MVP]`
**Status:** Planned

Ensure non-reporting-currency rows in an import have a resolvable exchange
rate before they are accepted.

**Acceptance criteria:**
- During import preview (F5-5), each row whose `currency` differs from the
  workspace `reporting_currency` is looked up against `currency_rates`
  (most recent rate with `effective_date ≤ row date`)
- Rows with a resolvable rate display the resolved rate and converted amount
  in the preview table
- Rows without a resolvable rate are flagged and excluded from the importable
  set; the preview message identifies which currency pairs and date ranges
  are missing and links to the rate management UI (F2-9)
- The rate used for each transaction is recorded on the transaction row at
  import time (`fx_rate_at_import`, `fx_rate_date`) for audit purposes

**Note:** The authoritative rate store is `currency_rates` (F2-9).
The `fx_log` table from earlier designs is superseded by this approach.

---

### F5-9 Row locking in import preview `[MVP]`
**Status:** Done

Allow users to mark individual import preview rows as "finished" so they are excluded from bulk operations while still being reviewable.

**Acceptance criteria:**

- A "Mark finished" button appears when one or more rows are selected (and none of the selected rows are already locked).
- Clicking it locks the selected rows:
  - They move to the bottom of the preview table, below all unlocked rows.
  - They are highlighted with a distinct background colour to distinguish them from editable rows.
  - All controls (category dropdown, property dropdown, type dropdown, any other editable fields) become read-only.
  - The row checkbox in the leftmost column remains active.
- Locked rows are excluded from:
  - "Update all selected with the same value" bulk operations.
  - "Select all with the same description" operations.
- When one or more locked rows are selected **and no unlocked rows are selected**, an "Unlock" button appears instead of the normal bulk-action buttons.
- Clicking "Unlock" restores the selected rows to their pre-lock state:
  - They move back to their original position in the table (by original parse order).
  - All controls become editable again.
- Lock/unlock state is local to the current import session; it is not persisted.
- The "Import N rows" count reflects only unlocked rows (locked rows are not submitted).

**Scope:** Frontend only (`index.html` import preview section). No backend changes required.

---

### F5-10 Sortable columns in import preview `[MVP]`
**Status:** Done

Allow the user to sort the import preview table by any data column with a single click, toggling between ascending and descending, with a clear sort indicator.

**Acceptance criteria:**

- Clicking a column header sorts the preview rows by that column; first click = ascending, second click on the same column = descending.
- Sortable columns: date, description, property, category, notes, amount.
- The active sort column shows a directional indicator (e.g. `▲` / `▼`) in the header.
- All other column headers show no indicator (only one column is sorted at a time).
- Clicking a different column resets direction to ascending and clears the previous column's indicator.
- Sort is in-memory only; it does not affect the underlying `State.importRows` array order, so original row indices (used for field updates, ignore flag, etc.) are preserved.
- The "Update all selected" and "Select all with same description" bulk actions continue to operate on the logical row data regardless of display sort order.

**Scope:** Frontend only (`index.html` import preview section). No backend changes required.

---

### F5-11 Highlight missing required notes in import preview `[MVP]`
**Status:** Done

Visually flag notes fields that are required but empty, so the user can fill them before submitting the import.

**Acceptance criteria:**

- When a row's `category` requires a note (currently: `other_expense`), and the notes field is empty, the notes input is given a subtle red background.
- The highlight updates in real time as the user changes the category dropdown or types into the notes field — no page reload or button click needed.
- The highlight is on the notes input only, not the entire row.
- If the user fills in a note, the red background is removed immediately.
- If the user changes category away from `other_expense`, the red background is removed immediately.
- The "Import N rows" button (or submission flow) should block import and show a validation message if any non-ignored row still has a required-note category with an empty notes field.

**Scope:** Frontend only (`index.html` import preview section). No backend changes required — the backend already enforces this via HTTP 422.

---

### F5-12 Duplicate detection and auto-ignore in import preview `[MVP]`
**Status:** Done

**Implementation note:** Fully implemented. Backend: `POST /api/transactions/import/check` with workspace-scoped matching, property join, case-insensitive description, most-recent-match logic (with tests). Frontend: `_batchCheckDuplicates()` at preview load, `_checkSingleRowDuplicate(i)` on property/description change, `_applyDupResult()` sets `_isDuplicate`/`_duplicateMatch`/auto-ignore, amber row background, Duplicate badge with hover tooltip, integrated with F5-13 grouping sections.

During the import preview (F5-5), each parsed row is checked against existing workspace transactions. Matched rows are visually flagged, defaulted to ignored, and show the matching existing transaction on hover/click so the user can make an informed decision before importing.

#### Duplicate key

A row is a duplicate if an existing transaction in the same workspace matches **all four** fields:

| Field | Source | Match rule |
|---|---|---|
| `property_id` | Property selected for that row in the preview | Exact match |
| `date` | Date parsed from CSV | Exact date match |
| `description` | Current description value for that row — original CSV value, or user override if one has been entered | Case-insensitive exact string match against `raw_description` on existing transactions |
| `amount` | Absolute amount parsed from CSV | Exact numeric equality |

Property is always required in the key — the same date/description/amount combination can legitimately occur across different properties. If `property_id` is not yet set on a row, that row is left in a **pending** state until the user assigns a property.

#### Backend — new endpoint

`POST /api/transactions/import/check`

- **Input:** array of `{ property_id, date, description, amount }` objects — one per row, order preserved
- **Output:** array of the same length — each element is `null` (no match) or a match object:
  ```json
  {
    "id": 1042,
    "date": "2024-03-01",
    "description": "Rent March",
    "amount": "1500.00",
    "created_at": "2024-03-15T09:12:00Z",
    "import_batch": "3f2a…"
  }
  ```
- Workspace-scoped; read-only and idempotent
- Property resolution: resolves `property_id` → associated account IDs via `account_properties` join when matching `account_id` on existing transactions
- If multiple existing transactions match, returns the most recently created one

#### Frontend — import preview behaviour

**At preview load:**
- All rows that already have `property_id` set (by rules, bank profile, or defaults) are sent in a single batch call to `POST /api/transactions/import/check`
- Rows without a property assigned yet show a neutral state — no duplicate badge, ignore not forced — until property is set

**When the user assigns a property to a row:**
- Trigger `POST /api/transactions/import/check` for that single row with its current `{ property_id, date, description, amount }` values
- Update the row's duplicate status immediately on response

**When the user overrides a description on a row:**
- Re-trigger the check for that row on blur/change, since description is part of the key
- Update the row's duplicate status on response

**Duplicate row visual treatment:**
- Amber/yellow row background
- A "Duplicate" badge in a status column
- Hovering or clicking the badge shows a popover/tooltip with the matching existing transaction: date, description, amount, and "Imported on [date]" derived from `created_at`
- The row's ignore flag is set to `true` by default

**User overrides:**
- The user can uncheck ignore on any duplicate row to include it in the import (e.g. re-importing after a correction)
- If a re-check returns no match (user changed property or description), the duplicate badge is cleared and ignore reverts to `false` unless the user had manually set it

**Import count:** "Import N rows" excludes all ignored rows regardless of reason.

#### Acceptance criteria

1. At preview load, rows with property already set are batch-checked before the table renders.
2. Rows without a property show no badge and no forced ignore until property is assigned.
3. When the user assigns a property to a row, the check fires and updates that row immediately.
4. When the user overrides a row's description, the check re-fires for that row on blur/change.
5. Duplicate rows show an amber background and a "Duplicate" badge.
6. Hovering or clicking the "Duplicate" badge shows a popover/tooltip: existing transaction's date, description, amount, and "Imported on [date]".
7. Duplicate rows have `ignore = true` by default.
8. The user can override `ignore` on any row regardless of duplicate status.
9. If a re-check returns no match, the badge is cleared and ignore reverts to `false` (unless the user had manually set ignore).
10. The import count excludes all ignored rows.
11. The check endpoint is strictly workspace-scoped and read-only.
12. If multiple existing transactions match the key, the most recently created one is shown in the popover.

**Dependencies:** F5-5 (import preview host), F3-4 (import endpoint context), F3-1 (transaction data model)

---

### F5-13 Group-by-status and float-selected in import preview `[MVP]`
**Status:** Done

Two independent toggle buttons in the import preview toolbar that control row display order. Both are frontend-only; no backend changes required.

---

#### Feature A — Group by status

A "Group" toggle button. When active, rows are split into five collapsible sections with labelled divider headers. Within each section, original parse order is preserved.

**Section order (top → bottom):**

| # | Label | Condition |
|---|-------|-----------|
| 1 | Unreviewed | No rule match, no user change, not ignored, not duplicate |
| 2 | Auto-matched | Rule applied (`_autoMatched`), not manually overridden, not ignored, not duplicate |
| 3 | Reviewed | `_userPickedCategory` or `_userPickedProperty` is `true`, not ignored, not duplicate |
| 4 | Duplicate | `_isDuplicate === true` — F5-12 placeholder; shown regardless of ignore state |
| 5 | Ignored | `_ignored === true && !_isDuplicate` |

Rows belong to exactly one section; precedence follows the order above (e.g. a row that is both `_isDuplicate` and `_userPickedCategory` falls into Duplicate, not Reviewed).

**Section headers:**
- Each header shows the section label and live row count, e.g. `Unreviewed (12)`.
- Clicking the header collapses or expands that section's rows.
- Collapsed sections show only the header line (row count still visible).
- All sections start expanded. Collapse state is local to the session (not persisted).

**`_isDuplicate` flag (code placeholder for F5-12):**
- Added to every row in `State.importRows` at parse time, defaulting to `false`.
- The section classification logic evaluates it, so wiring F5-12 later only requires setting the flag — no structural changes to the grouping code.
- No visible Duplicate section is rendered while the flag is always `false` (the section is suppressed when empty).

**`_userPickedProperty` flag:**
- Added alongside the existing `_userPickedCategory` flag.
- Set to `true` the first time the user changes the property dropdown on a row.
- Used solely for section classification (Reviewed vs Auto-matched/Unreviewed).

---

#### Feature B — Float selected to top

A separate "Float selected" toggle button in the same toolbar. When active, all rows with `_selected === true` are pulled into a `Selected (N)` section rendered above all group sections (or above the flat list if grouping is off). Floated rows are absent from their original section while floating.

**Deselect behaviour while float is active:** unchecking a row's checkbox immediately moves it back to its section (or parse position if grouping is off) — the floated section always exactly mirrors the live selection.

**Composability with grouping:**

| Grouping | Float | Result |
|----------|-------|--------|
| Off | Off | Flat parse order |
| On | Off | Five collapsible sections |
| Off | On | `Selected` section at top; remaining rows in parse order |
| On | On | `Selected` section at top; remaining rows in their five sections below |

**Scope:** `frontend/index.html` import preview section and `frontend/js/app.js` render logic. No backend changes.

**Dependencies:** F5-5 (import preview host); F5-12 to activate the Duplicate section.

---

### F5-14 Create category inline from import preview `[MVP]`
**Status:** Done

A "＋ New category…" option at the bottom of every category dropdown in the import preview table. Selecting it opens a small modal (label, type, auto-derived code). On save the category is created via `POST /api/workspace/enums/transaction-categories`, `State.transactionCategories` is refreshed, and the new category is applied to the triggering row (and to all bulk-selected rows if bulk-update mode is on). All category dropdowns in the table are rebuilt so the new option is immediately available everywhere.

**Scope:** `frontend/index.html` (new `modal-new-cat`), `frontend/js/app.js` (`openNewCategoryModal`, `closeNewCategoryModal`, `_newCatCodeAutoFill`, `submitNewCategoryFromImport`; intercept in `onRowFieldChange`), `frontend/js/importer.js` (`buildCategoryOptions` gains `__new__` sentinel option). No backend changes.

**Dependencies:** F5-5 (import preview host).

---

### F5-15 Workspace-managed bank profiles `[Backlog]`
**Status:** backlog

Bank import profiles (Jyske Bank, Nordea, mBank, Generic CSV) are currently
hardcoded as static `<option>` tags in `index.html` and derive their parsing
config from `BANK_PROFILES` in `frontend/config.js`. They appear in every
new workspace unconditionally, which looks like pre-loaded test data to any
user who doesn't use those specific banks.

Bank profiles should be workspace-scoped and start empty, with users opting
into preset profiles or defining their own — the same pattern as default
auto-categorisation rules (F5-3 "Load defaults" button).

**Acceptance criteria:**
- A new workspace has **no bank profiles** enabled by default; the import
  profile dropdown shows only a placeholder ("Add a profile to get started")
- A **Manage profiles** action (in Settings or the Import section) lets the
  user:
  - Enable one or more built-in preset profiles (Jyske Bank, Nordea, mBank,
    Generic CSV) — rendered as a list of templates to add with one click
  - Add a **custom profile**: name, delimiter, date format, date column,
    description column, amount column, decimal separator, rows to skip,
    default currency
  - Edit or delete any non-preset profile
  - Enable/disable preset profiles without losing their config
- Enabled profiles are stored in the database per workspace
  (`workspace_bank_profiles` table or as a JSONB column on `workspaces`)
- The import dropdown and the rules modal bank-profile selector are both
  built dynamically from the workspace's active profiles
- The hardcoded `<option>` tags in `index.html` are removed; `config.js`
  `BANK_PROFILES` becomes the source of preset template definitions only
- `GET /api/bank-profiles` — returns active profiles for the workspace
- `POST /api/bank-profiles` — adds a profile (preset key or custom config)
- `PATCH /api/bank-profiles/:id` — updates a custom profile
- `DELETE /api/bank-profiles/:id` — removes a profile; blocked if any
  existing rules or description mappings reference it (or offers to
  reassign them to "Any bank")

**Implementation notes:**
- Existing workspaces (pre-migration) should have their four current
  profiles auto-migrated as enabled presets so import history and rules
  that reference `jyske_bank` / `nordea_dk` / `mbank_pl` / `generic_csv`
  remain valid
- `loadDefaultRules()` should be reviewed alongside this — its preset rules
  reference specific profile keys and should remain valid after migration

**Dependencies:** F5-1, F5-2, F5-3 (rules reference bank_profile keys),
F5-4 (description_mappings reference bank_profile keys).

---

### F5-16 Per-row account selection in import preview `[MVP]`
**Status:** Backlog

Add an **Account** column to the import preview table. Each row is pre-populated with the account linked to its selected property. The user can override per-row before submitting. The column participates in all existing bulk-update behaviours. Hidden when `multi_accounts_enabled = false` (F1-13).

**Column appearance and population:**
- When `multi_accounts_enabled = true`, an Account column appears in the import preview table, positioned after the Property column
- Dropdown lists all active workspace accounts
- On initial population: account is set to the property's linked account (same as today's automatic resolution)
- If no property is set on the row, account defaults to the workspace default account
- Column participates in F5-10 sort (sortable header)

**Auto-update on property change:**
- When the user changes the property on a row, the account auto-resets to the new property's linked account — unless the user has already manually overridden the account on that row, tracked by a new `_userPickedAccount` flag (mirrors `_userPickedCategory` and `_userPickedProperty`)
- If `_userPickedAccount = true`, a property change does not touch the account field

**Multi-row bulk update (all existing patterns apply):**
- Changing account on a row with selected peers triggers the same "Update all selected rows?" prompt as category/property changes
- "Select all with same description" applies the same account update to matching rows
- Locked rows (F5-9) are excluded from bulk account updates

**Section classification (F5-13 grouping):**
- A row with `_userPickedAccount = true` qualifies as **Reviewed** in the group-by-status sections, even if category and property are auto-matched

**Submit behaviour:**
- Each row's `account_id` is read directly from the Account dropdown value
- Replaces the current post-hoc `prop?.account_id` resolution in `submitImport()`; backend `POST /api/transactions/import` is unchanged

**Column visibility:**
- When `multi_accounts_enabled = false`, the column is entirely absent; account is resolved at submit time using: property's linked account → workspace default account

**Files affected:**
- `frontend/js/app.js` — account dropdown rendering, `_userPickedAccount` flag, auto-update on property change, bulk-update integration, submit resolution
- `frontend/index.html` — Account column header

**No backend changes required.**

**Dependencies:** F5-5 (import preview host), F1-13 (visibility gate)

---

### F5-17 Auto-categorisation rule edit view and enable/disable toggle `[Backlog]`
**Status:** Backlog

Auto-categorisation rules (F5-3) currently only support a flat list with drag-to-reorder. There is no way to edit an existing rule's fields in-place, and rules cannot be suspended without deleting them.

This feature adds a dedicated edit view for individual rules — consistent with the transaction edit modal and split-rule editing patterns — and a per-rule enabled/disabled toggle matching the split-rule on/off behaviour.

**Acceptance criteria:**

**Edit view:**
- Each rule row in the rules table has an **Edit** action (pencil icon or row-level button)
- Clicking Edit opens an inline expanded row or a modal (follow whichever pattern split-rule editing uses) showing all editable rule fields:
  - Keyword
  - Category
  - Bank profile (optional, "Any bank" if unset)
  - Property (optional)
  - Sort order (read-only display; drag-to-reorder remains the primary mechanism)
- Changes are saved via `PATCH /api/rules/:id` on confirmation; cancelling leaves the rule unchanged
- Validation mirrors `POST /api/rules` (keyword and category required)
- The Add rule form (currently inline) should use the same layout/component as the edit view for visual consistency

**Enable/disable toggle:**
- Each rule row displays a toggle (checkbox or switch, matching the split-rule pattern) indicating whether the rule is active
- Toggling calls `PATCH /api/rules/:id` with `{ enabled: true/false }`
- Disabled rules are visually dimmed in the list (same treatment as disabled split rules) and are excluded from the matching pipeline in `applyRules()` in `frontend/js/importer.js`
- Backend `GET /api/rules` returns `enabled` on each rule; the matching function skips rules where `enabled === false`

**Backend changes:**
- Add `enabled` column (boolean, default `true`) to the `rules` table via a new migration
- `GET /api/rules` — include `enabled` in the response
- `PATCH /api/rules/:id` — accept and persist `enabled`
- `POST /api/rules` — accept optional `enabled`; defaults to `true`

**Frontend files likely affected:**
- `frontend/index.html` — rule row template; add toggle and edit action
- `frontend/js/app.js` — `renderRules()`, `openRuleEditView()`, `saveRule()`, `toggleRule()`; update `applyRules()` call (or pass `enabled` filter to `importer.js`)
- `frontend/js/importer.js` — `applyRules()` skips rules where `enabled === false`
- `backend/src/routes/rules.js` — handle `enabled` in GET/POST/PATCH
- `backend/migrations/` — new migration adding `enabled` column

**Dependencies:** F5-3 (rules API and rules list UI, both done).

---

### F5-8 Direct bank connection `[Future]`
**Status:** Future

Connect to a bank's open banking API to pull transactions automatically.

**Acceptance criteria:**
- User authorises access to their bank via OAuth (PSD2 / open banking)
- Transactions are pulled on a schedule and appear in the import preview (same flow as CSV)
- Supported initially for Danish banks (Jyske Bank, Nordea) via a PSD2 aggregator

**Note:** This requires third-party API agreements and is explicitly post-MVP.

---

## Bugs

### B5-5-2 Import preview shows all amounts as positive
**Status:** Fixed  
**Feature:** F5-5 Import preview  
**Symptom:** CSV rows with negative amounts (debits/expenses) show as positive in the preview table, making it impossible to visually confirm income vs expense categorisation.  
**Root cause:** `importer.js` calls `Math.abs(amount)` before building the row object. The sign is used to determine `type`/`category` (correct, per data model), but is then discarded from `amount`. The preview renders `row.amount` which is always positive.  
**Fix:** Display the amount in the preview with a `-` prefix and expense CSS class for expense rows, so the visual sign reflects the stored `type`. The data model (amounts always positive, sign in `type`) is unchanged.

---

### B5-5-1 `DB is not defined` on Preview Import click
**Status:** Fixed  
**Feature:** F5-5 Import preview  
**Symptom:** Clicking "Preview Import" after column mapping throws `Parse error: DB is not defined` in the browser.  
**Root cause:** `importer.js` calls `DB.applyRules()` — a leftover v1 Google Sheets helper. In v2, rules are passed in as a plain array from `State.rules` (fetched via `Api.getRules()`). No `DB` object exists.  
**Fix:** Replaced `DB.applyRules(rawDesc, profileKey, rules)` with a self-contained `applyRules(rawDesc, profileKey, rules)` function in `importer.js` that does case-insensitive keyword matching respecting `bank_profile` and `sort_order`.

---

## Dependencies
- Rules table (created in M2 migrations)
- Auth middleware (M3)
- `POST /api/transactions/import` endpoint (F3-4)
- `DELETE /api/transactions/import/:batch_id` endpoint (F3-5)

## Notes
- The existing `js/importer.js` is the reference implementation for the client-side pipeline. Do not move parsing logic to the backend — it belongs in the browser where the file lives.
- Bank profiles are hardcoded in `js/importer.js`. New profiles are added there, not in the database.
- The `fx_log` table is informational only — it does not drive P&L calculations. Amounts are always stored in their native currency.
