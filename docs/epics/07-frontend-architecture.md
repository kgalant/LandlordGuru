# Epic 7 — Frontend Architecture

## Goal
Improve the structural quality of the frontend without changing user-visible behaviour. The primary deliverable is a reusable `DataTable` component that replaces all hand-rolled table implementations across the app, giving every tabular screen consistent behaviour (sticky rows, filtering, sorting, pagination, column visibility) for near-zero marginal cost when new tables are needed.

## Status
Planned.

---

## Features

### F7-1 DataTable component — core build `[Done]`
**Status:** Done

Create `frontend/js/datatable.js` and `frontend/css/datatable.css` as the standalone DataTable component. No table migrations in this step — the component is built and smoke-tested in isolation.

**Component responsibilities:**
- Renders four sticky regions (header bar, filter bar, column headers, footer/pager) around a scrollable body
- Tracks sort state (`col`, `dir`) internally; passes `sort_col` + `sort_dir` through `fetchData` from day one (callers/backend may ignore unused params)
- Tracks filter values internally; calls `fetchData` on any change
- Tracks pagination state internally; calls `fetchData` on page or limit change
- Tracks column visibility in `localStorage` when `columnVisibility.storageKey` is set
- Exposes `table.refresh()` and `table.reset()` on the returned instance
- Does **not** know about the backend — all data access via caller-supplied `fetchData` callback
- Does **not** render row content — caller-supplied `renderRow` keeps domain logic in the caller

**Configuration API:**
```javascript
DataTable.create({
  // Required
  containerId: 'some-wrap',              // DOM element to render into
  columns: [ ... ],                      // column definitions (see below)
  fetchData: async (params) => { ... },  // returns { data: [], total: N }
  renderRow: (row, visibleCols) => '…',  // returns HTML string for one <tr>

  // Optional — header bar
  title: 'My Table',
  actions: [
    { label: '+ Add', onclick: 'openModal()' },
  ],

  // Optional — pagination (omit or enabled:false = show all rows)
  pagination: {
    enabled: true,
    defaultLimit: 50,
    limitOptions: [10, 25, 50, 100],
  },

  // Optional — bulk actions (requires checkbox column)
  bulkActions: [
    { label: 'Delete selected', onclick: handlerFn },
  ],

  // Optional — column visibility toggle (⚙ button in header bar)
  columnVisibility: {
    enabled: true,
    storageKey: 'datatable-<id>-columns',
  },
});
```

**Column definition:**
```javascript
{
  key:            'category',
  label:          'Category',
  sortable:       false,
  defaultVisible: true,
  filter: {
    type:        'select',           // 'select' | 'text' | 'date-range' | 'toggle'
    placeholder: 'All categories',
    options:     () => State.categories,  // array or function → array
  },
}
```

When a column is hidden (via ⚙ or `defaultVisible: false`), its `<th>`, all `<td>` cells in that column, and its filter control are all hidden. The filter value is also reset so it does not silently filter the data. At least one column must remain visible (the last visible checkbox is disabled).

**Layout (all regions except body are sticky):**
```
┌──────────────────────────────────────────────────────────┐
│  [Title]                    [btn] [btn] [⚙ Columns ▼]   │  ← sticky: header bar
├──────────────────────────────────────────────────────────┤
│  [Filter ▼]  [Filter ▼]  [Filter ▼]  [🔍 search___]     │  ← sticky: filter bar (optional)
├──────────────────────────────────────────────────────────┤
│  ☐  COL-A ↓   COL-B    COL-C    COL-D        (actions)  │  ← sticky: column headers
├──────────────────────────────────────────────────────────┤
│  ☐  data      data      data     data         [edit]     │
│  ...                                                      │  ← scrollable body
├──────────────────────────────────────────────────────────┤
│  Rows 1–50 of 247   [‹ 1 2 3 … ›]   [50/page ▼]        │  ← sticky: footer / pager
└──────────────────────────────────────────────────────────┘
```

**CSS approach** (flexbox column, overflow on body only):
```css
.dt-wrap        { display: flex; flex-direction: column; overflow: hidden; }
.dt-header-bar,
.dt-filter-bar,
.dt-col-headers { flex-shrink: 0; }
.dt-body        { flex: 1; overflow-y: auto; }
.dt-footer      { flex-shrink: 0; }
```

**New files:**
- `frontend/js/datatable.js`
- `frontend/css/datatable.css` (add `<link>` in `index.html`)

**Acceptance criteria:**
- Component renders correctly with a minimal config (no filters, no pagination, no bulk ops)
- Component renders correctly with all options enabled
- Sticky regions stay fixed while the body scrolls
- Hiding a column via ⚙ removes the column and its filter; value resets
- Column visibility survives a page refresh (localStorage)
- `renderRow` and `fetchData` are never called with column or sort context that is inconsistent with visible state

---

### F7-2 Migrate transactions table to DataTable `[Done]`
**Status:** Done

The reference migration. Replace the hand-rolled transactions table (`renderTxTable`,
`renderTxPagination`, `TxSort`, `TxListState`, inline filter reads) with a `DataTable.create()`
call. All existing functionality must be preserved exactly.

**Changes:**
- `index.html`: replace `#tx-sticky-header` / `#tx-table-body` static markup with `<div id="tx-table-wrap">`
- `app.js`: replace `renderTxTable`, `renderTxPagination`, `TxSort`, `TxListState`, filter-event wiring with a `DataTable.create({ ... })` call
- `renderRow` → thin wrapper around the existing `txRow()` function
- `fetchData` → existing `Api.getTransactions()` call with sort params added

**Acceptance criteria:**
- Sort (date, amount), filter (all 6 filters), pagination, bulk-delete, sticky rows all behave identically to before
- No regression in any other page or feature
- Replaced code deleted from `app.js` (no dead code left behind)

**Dependencies:** F7-1

---

### F7-3 Migrate rules table to DataTable `[Planned]`
**Status:** Planned

Migrate the rules table. Simpler than transactions: no filter bar, no pagination, no bulk ops, one delete button per row.

**Purpose:** Validates that the component is not over-fitted to the transactions use case. Tests `pagination: { enabled: false }` and zero-filter configuration.

**Acceptance criteria:**
- Rules table renders and behaves identically to before
- No filter bar rendered (none configured)
- No pagination controls rendered
- Delete button per row continues to work
- No regression in any other page

**Dependencies:** F7-1

---

### F7-4 Migrate report tables to DataTable `[Planned]`
**Status:** Planned

Migrate the three read-only report tables: category breakdown ×2 and P&L by property.

**Purpose:** Tests the "display only" configuration (no sort, no filter, no pagination). `fetchData` returns pre-computed data from the `Reports` module — no API call involved.

**Acceptance criteria:**
- All three report tables render identically to before
- Column visibility toggle available (useful for hiding columns on small screens)
- No regression in report calculations or layout

**Dependencies:** F7-1

---

### F7-5 Migrate dashboard mini-table to DataTable `[Planned]`
**Status:** Planned

Migrate the dashboard recent-transactions mini-table (5 rows, read-only, no controls).

**Purpose:** Validates the component at minimum config — no header actions, no filter bar, no pagination.

**Acceptance criteria:**
- Dashboard mini-table renders identically to before
- No controls rendered (none configured)
- No regression on the dashboard page

**Dependencies:** F7-1

---

## Out of scope

- **Import preview table** — editable cells, per-row validation states, and row enable/disable checkboxes make it a genuinely different problem. It remains bespoke for now. Revisit after F7-5 if an `editable` mode for `DataTable` seems worthwhile.
- **Import mapping table** — 3-column static mapping UI; too simple and specialised to benefit from the component.

---

## Bugs

### F7-B1 — Sort by property sorts by ID not name `[Backlog]`
**Status:** Backlog

The property column sorts by `ap.property_id` (numeric) rather than the property name. Users expect alphabetical sort. Fix requires joining the `properties` table in `GET /api/transactions` and ordering by `p.name` when `sort_col=property`.

---

## Dependencies
- F7-1 must land before any migration step (F7-2 through F7-5).
- Migration steps are independent of each other once F7-1 is done and can be done in any order, though the recommended order (transactions → rules → reports → dashboard) goes most-complex-first.

## Notes
- Each migration step should leave `app.js` smaller, not larger. Deleted code is a success metric.
- Backend tests (`npm test`) are unaffected by this epic — all changes are frontend-only.
- No version bump required for pure refactors; bump only if user-visible behaviour changes.
