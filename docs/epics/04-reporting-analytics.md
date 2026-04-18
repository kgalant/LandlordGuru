# Epic 4 — Reporting and Analytics

## Goal
Provide income statements, tax reports, and flexible data views built on a pivot table model. Reports must handle sparse and optional data (e.g., workspaces without tenant tracking) gracefully.

## Status
Planned. A pure-function reporting layer exists in the frontend (`js/reports.js`) operating on Google Sheets data. It will be replaced or supplemented by a backend reporting API.

---

## Background: Pivot table model

Reports are not hardcoded layouts. They are driven by a pivot table approach:
- A **dimension** is a field you can group or filter by (property, category, month, tenant, account)
- If a dimension is not present in a workspace (e.g., tenant tracking is off), it simply is not available as a pivot option
- Users slice and dice data based on what's actually in their workspace
- This avoids complexity in the reporting engine by treating optional dimensions as absent, not null

---

## Features

### 4.1 Income statement (P&L) report `[MVP]`
Summarise income and expenses for a date range, grouped by category.

**Acceptance criteria:**
- `GET /api/reports/pnl` — accepts: `from`, `to` (date range), optional `property_id`
- Returns:
  - Income total, broken down by category
  - Expense total, broken down by category
  - Net P&L
  - `transfer` / `inter_account` transactions excluded
- Response includes the date range and any applied filters for traceability
- Amounts are returned in each transaction's native currency; the client handles FX conversion for display

---

### 4.2 P&L report UI `[MVP]`
Frontend view of the income statement.

**Acceptance criteria:**
- Date range picker (default: current calendar year)
- Property filter (all properties or a specific one)
- Table rows: category → amount
- Subtotals for income and expenses; net P&L highlighted
- Currency toggle (if workspace has multi-currency properties): show native or convert to base currency
- Print-friendly layout (CSS media query)

---

### 4.3 Per-property breakdown `[MVP]`
P&L broken out by property within a date range.

**Acceptance criteria:**
- `GET /api/reports/pnl?group_by=property` — returns one P&L block per property
- Properties with no transactions in the period still appear (zero values)
- UI: stacked table or expandable rows per property

**Dependencies:** 4.1 must be complete first.

---

### 4.4 Monthly trend view `[MVP]`
Income and expense totals by month across a year.

**Acceptance criteria:**
- `GET /api/reports/monthly` — accepts `year`, optional `property_id`
- Returns 12 months of income and expense totals (zero-filled for months with no data)
- UI: table with Jan–Dec columns; income row, expense row, net row

---

### 4.5 Tax report `[MVP]`
Annual summary formatted for tax filing purposes.

**Acceptance criteria:**
- `GET /api/reports/tax?year=YYYY` — returns annual totals per category
- Distinguishes deductible expenses from non-deductible (based on category)
- Returns data in a structure ready for export (not opinionated about jurisdiction — user applies their own rules)
- UI: clean printable summary grouped by income / deductible expense / non-deductible expense

**Note:** The app does not give tax advice. The report is a structured summary; the user applies jurisdiction-specific rules.

---

### 4.6 Data export `[MVP]`
Download transaction data as a file for use in Excel or other tools.

**Acceptance criteria:**
- `GET /api/export/transactions` — accepts same filters as `GET /api/transactions`
- Returns CSV with columns: date, property, type, category, description, amount, currency, notes, reconciled
- `Content-Disposition: attachment` header so the browser triggers a download
- UI: "Export" button on the transaction list, respects current filter state

---

### 4.7 Pivot table UI `[Future]`
Interactive pivot table allowing users to group and filter by any available dimension.

**Acceptance criteria:**
- Dimensions available as row/column groupings: property, account, category, month, quarter, year
- Optional dimensions (e.g., tenant) appear only when enabled in the workspace
- Filters: date range, property, type
- Cell values: sum of amounts; click-through to filtered transaction list
- Export pivot result as CSV

**Dependencies:** 4.1–4.4, Epic 2 accounts (2.4), optionally Epic 2 tenants (2.5).

---

### 4.8 Google Sheets / Excel export `[Future]`
Export a formatted report directly to a Google Sheet or `.xlsx` file.

**Acceptance criteria:**
- "Export to Excel" downloads a formatted `.xlsx` with multiple tabs (summary, by-property, by-month, transactions)
- "Export to Google Sheets" creates a new sheet in the user's Google Drive with the same structure

---

## Dependencies
- Transaction API (Epic 3, feature 3.1) — all reports query transactions
- Properties API (Epic 2, feature 2.1) — for per-property breakdowns
- Auth middleware (M3)
- Accounts schema (Epic 2, feature 2.3) — needed before account-level pivoting

## Notes
- The existing `js/reports.js` contains working P&L logic (filtering, aggregation). The backend API can be modelled on this logic.
- FX conversion: amounts are stored in native currency. The client applies FX rates at display time using `CONFIG.FX_RATES`. The backend does not perform currency conversion.
- `inter_account` transfers must always be excluded from P&L to avoid double-counting.
