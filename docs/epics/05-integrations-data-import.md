# Epic 5 — Integrations and Data Import

## Goal
Make bulk import of bank transaction exports a first-class, low-friction workflow. Support multiple bank CSV formats, column mapping, and auto-categorisation rules.

## Status
Partially done. The frontend (`js/importer.js`) contains a complete CSV parsing pipeline with column mapping and bank profiles. This logic stays client-side. What's missing is the backend-side rules API and the import endpoint (covered in Epic 3, feature 3.4).

---

## Background

The import pipeline is intentionally split:

1. **Client-side (done):** CSV parsing, column mapping, date/amount parsing, bank profile detection, rule application, preview
2. **Server-side (planned):** Rules storage, bulk insert endpoint, duplicate detection, batch rollback

This split means users see a preview of all rows before anything is written to the database.

---

## Features

### 5.1 CSV parsing and column mapping `[MVP] [Done — frontend]`
Parse a bank-exported CSV file and map its columns to transaction fields.

**Acceptance criteria:**
- Accepts CSV files with configurable delimiter (`,` or `;`)
- User maps columns to roles: Date / Description / Amount / Ignore
- Configurable: date format, decimal separator, rows to skip
- A mapping can be saved under a name and auto-applied when the same bank profile is detected
- Saved mappings are stored in `localStorage` under `lg_col_mappings_v1`
- Parsing errors (bad date, bad amount) are reported per-row; invalid rows are excluded from the preview

---

### 5.2 Bank profiles `[MVP] [Done — frontend]`
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

### 5.3 Auto-categorisation rules `[MVP]`
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

### 5.4 Description mappings `[MVP]`
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
  3. Auto-categorisation rules (5.3)
  4. Default: `rent` if amount positive, `other_expense` if negative

---

### 5.5 Import preview `[MVP] [Done — frontend]`
Show the user all parsed rows with their proposed category and property before committing.

**Acceptance criteria:**
- After CSV parsing and rule application, display a table of all rows
- Columns: date, description, amount, proposed category, proposed property
- Rows with errors (unparseable date/amount) are shown in red and excluded from the import
- User can override category and property per-row before importing
- "Import N rows" button submits the validated rows to `POST /api/transactions/import` (Epic 3, feature 3.4)
- Duplicate rows (same date + amount + description already in workspace) are highlighted with a warning

---

### 5.6 Import history `[MVP]`
View and roll back previous import batches.

**Acceptance criteria:**
- UI section shows recent import batches: date of import, bank profile used, number of rows, user who imported
- Each batch has an "Undo" action that calls `DELETE /api/transactions/import/:batch_id` (Epic 3, feature 3.5)
- Undo is only available for the importing user or workspace owners
- After undo, the batch disappears from history

**Dependencies:** Epic 3, feature 3.5 (import batch rollback).

---

### 5.7 FX rate logging `[MVP — passive]`
Record the exchange rates in use at the time of import for audit purposes.

**Acceptance criteria:**
- When an import includes non-base-currency transactions, the current FX rates are written to `fx_log`
- `GET /api/fx-log` — returns rate snapshots for the workspace
- No UI required — informational only; rates are visible in a raw log view if needed

---

### 5.8 Direct bank connection `[Future]`
Connect to a bank's open banking API to pull transactions automatically.

**Acceptance criteria (future):**
- User authorises access to their bank via OAuth (PSD2 / open banking)
- Transactions are pulled on a schedule and appear in the import preview (same flow as CSV)
- Supported initially for Danish banks (Jyske Bank, Nordea) via a PSD2 aggregator

**Note:** This requires third-party API agreements and is explicitly post-MVP.

---

## Dependencies
- Rules table (created in M2 migrations)
- Auth middleware (M3)
- `POST /api/transactions/import` endpoint (Epic 3, feature 3.4)
- `DELETE /api/transactions/import/:batch_id` endpoint (Epic 3, feature 3.5)

## Notes
- The existing `js/importer.js` is the reference implementation for the client-side pipeline. Do not move parsing logic to the backend — it belongs in the browser where the file lives.
- Bank profiles are hardcoded in `js/importer.js`. New profiles are added there, not in the database.
- The `fx_log` table is informational only — it does not drive P&L calculations. Amounts are always stored in their native currency.
