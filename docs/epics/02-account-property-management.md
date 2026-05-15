# Epic 2 — Account and Property Management

## Goal
Allow users to define the properties in their portfolio and optionally group
them into accounts — flexible accounting containers that bridge properties
and transactions.

## Status
In progress. The `properties` table exists. Migration `008_accounts.js` adds
`accounts` and `account_properties` tables and replaces
`transactions.property_id` with `transactions.account_id`.

---

## Background: Properties vs Accounts

A **property** is a physical unit with an address, currency, tenant, and
lease information.

An **account** is a logical grouping for accounting purposes. It bridges one
or more properties to transactions. The account structure is workspace-level —
all users in a workspace share the same account hierarchy.

**Hierarchy**: Accounts form a parent-child tree. The default account is
always the root (top-level); it cannot be a child of any other account.
Any additional account can either be a standalone top-level account or a
child of an existing account. The hierarchy is freeform — the system enforces
no semantic meaning on levels. Different workspaces can use accounts to
represent companies, buildings, units, tenants, or any other grouping that
makes sense to them. Example structures:

- *Company → Property → Unit → Tenant* (4-level)
- *Default (general) + one account per property + unit-level children*
- *One default account for everything* (simple case — no hierarchy needed)

**Roll-up and filtering**: A parent account aggregates the figures of all its
descendants. Filtering by an account in any report implicitly includes all
descendant accounts. These two properties are the primary value of the
hierarchy.

**Maximum depth**: Each workspace carries a `max_account_depth` setting
(default: 5, no system ceiling). The UI is designed for reasonable depth;
workspaces with unusual structures can raise this setting via workspace
settings (F1-6).

**Default workspace account**: Every workspace has exactly one
`is_default = true` account, created automatically when the workspace is
created. It is the catch-all for any operation that needs "which account?"
when nothing more specific applies. The default account cannot be deleted
without designating a replacement, and it cannot have a parent.

**Account resolution order** (for any operation that needs "which account?"):
1. Explicitly selected account (user picked one in the UI)
2. Auto-created account linked to the selected property (via `account_properties`)
3. Workspace default account (`is_default = true`)

**Account status**: Accounts are either `active` or `archived`. Archived
accounts are read-only — no new transactions or properties can be linked to
them, but they remain queryable for historical reporting. Account rows are
never hard-deleted; `status = archived` is the terminal state.

**Simple case**: Users who never configure accounts never encounter the
hierarchy. Every transaction and property resolves to the default account
automatically.

---

## Features

### F2-1 Property CRUD `[MVP]`
**Status:** Done

Create, view, edit, and archive properties.

**Acceptance criteria:**
- `GET /api/properties` — returns all active properties in the workspace,
  sorted by name
- `POST /api/properties` — creates a property; required fields: `name`,
  `country`, `currency`, `model`
- `PATCH /api/properties/:id` — updates any field on a property
- `DELETE /api/properties/:id` — sets `active = false` (soft delete); does
  not remove transaction history
- All routes require authentication; `workspace_id` is injected from JWT,
  never accepted from the client
- `created_by` and `last_modified_by` are stamped from `req.user.id`

**Fields (see `docs/data-model.md` for full schema):**
`name`, `address`, `country`, `currency`, `model` (`longterm` or `airbnb`),
`rent`, `aconto`, `tenant`, `lease_start`, `notes`, `active`

**Implementation notes:**
- Route: `backend/src/routes/properties.js`
- Tests: `backend/tests/properties.test.js` (13 tests, all passing)
- Migration: `backend/src/db/migrations/002_properties.js`
- `POST /api/properties` auto-creates a matching account and links it via
  `account_properties` in a single transaction (per F2-3 spec). The
  auto-created account has `is_default = false` and the same name as the
  property.
- `GET /api/properties` returns each property with its linked `account_id`
  via a LEFT JOIN on `account_properties`.

---

### F2-2 Property list UI `[MVP]`
**Status:** Done

Frontend view showing all active properties with key fields.

**Acceptance criteria:**
- Lists all active properties returned by `GET /api/properties`
- Shows: name, address, tenant, model, rent, currency
- "Add property" button opens a form (F2-1)
- Clicking a property opens its detail/edit view
- Archived properties are hidden by default; an option reveals them

---

### F2-3 Account model `[MVP]`
**Status:** Done

Accounts and their relationship to properties are defined in
`008_accounts.js`. The schema requires updates to support hierarchy.

**Decisions (confirmed):**
- An account has a name and belongs to a workspace
- An account can have a parent account (self-referential FK); the default
  account always has `parent_account_id = NULL`
- An account links to one or more properties via the `account_properties`
  join table; properties link to whichever account in the hierarchy
  represents them — not necessarily the root or a leaf
- `transactions.property_id` is replaced by `transactions.account_id` —
  transactions belong to an account, not directly to a property
- On property creation, the backend auto-creates a matching account and
  links them — simple workspaces never need to think about accounts
- The API must reject circular parent references
- Resulting hierarchy depth must not exceed the workspace `max_account_depth`

**Schema:**
- `accounts` table: `id`, `workspace_id`, `name`, `notes`,
  `parent_account_id` (nullable FK → `accounts.id`), `is_default` (boolean),
  `status` (`active` | `archived`), audit fields
- Constraint: `parent_account_id` must be `NULL` when `is_default = true`
- `account_properties` join table: `(account_id, property_id)` composite PK
- `transactions.account_id` FK → `accounts.id` (nullable)
- `workspace_settings` (on `workspaces` row or separate table):
  `max_account_depth` integer (default 5) — see F1-6

**To query transactions for a specific property:** join
`transactions → account_properties` on `account_id`, filter by `property_id`.

**To query an account and all descendants:** recursive CTE on
`parent_account_id`.

**Note on future versioning:** Account rows are never hard-deleted; `status`
= `archived` is terminal. This keeps historical transaction links intact and
enables future account structure versioning (F2-8).

---

### F2-4 Account CRUD `[MVP]`
**Status:** Done

Create, view, edit, archive, and delete accounts.

**Acceptance criteria:**
- `GET /api/accounts` — returns all accounts in the workspace; supports
  `status` filter (`active`, `archived`, `all`)
- `GET /api/accounts/:id` — returns a single account with its position in
  the hierarchy (parent path, direct children)
- `POST /api/accounts` — creates an account; required: `name`; optional:
  `parent_account_id` (must exist in same workspace, must not create a
  cycle, resulting depth must not exceed `max_account_depth`)
- `PATCH /api/accounts/:id` — updates `name`, `notes`, or
  `parent_account_id`; re-parenting validates cycle prevention and depth
  limit; cannot set `parent_account_id` on the default account
- `DELETE /api/accounts/:id` with required body `{ reassign_to: <account_id> }` —
  atomic operation: relinks all transactions and properties from this account
  to `reassign_to`, then sets `active = false`; `reassign_to` must be active
  and in the same workspace
- Cannot delete the default account without first designating a replacement
  via `POST /api/accounts/:id/set-default` on another top-level account
- `POST /api/accounts/:id/set-default` — designates an account as the new
  workspace default; target must be top-level (`parent_account_id` is null);
  previous default loses the flag
- Accounts can be linked to properties via
  `POST /api/accounts/:id/properties`

**Dependencies:** F2-3 (schema) must be complete first.

---

### F2-5 Tenant and lease management `[Future]`
**Status:** Future

Track tenant identity, lease start/end dates, and link transactions to
specific tenants.

**Acceptance criteria:**
- `tenants` table: name, email, phone, notes
- `leases` table: `property_id`, `tenant_id`, `start_date`, `end_date`,
  `rent`, `deposit`
- Transactions can optionally link to a `lease_id`
- Unlinked transactions remain valid — no retroactive tagging required
- Tenant tracking is opt-in per workspace (a workspace setting enables the
  Tenants section)

**Dependencies:** F2-1, F2-4.

---

### F2-6 Account hierarchy management UI `[MVP]`
**Status:** Done

Configuration interface for managing the account tree.

**Acceptance criteria:**
- Tree view of the full account hierarchy showing name, status, and default
  indicator for each account
- "Add account" action: enter name, optionally select a parent from the
  existing tree; depth limit enforced client-side before submit
- "Set as default" action on any top-level active account (prompts
  confirmation)
- "Delete account" action: opens a picker to select the reassignment target
  account; shows count of transactions and properties to be reassigned;
  on confirmation triggers the atomic `DELETE /api/accounts/:id` operation
- Archived accounts visible in a collapsed section; not selectable as
  reassignment targets or parents for new accounts
- Re-parent an account via its edit form (change parent)

**Dependencies:** F2-4.

---

### F2-7 Account linked-items view `[MVP]`
**Status:** Done

Single view listing everything tied to a specific account, to support
reassignment decisions before or during deletion.

**Acceptance criteria:**
- Accessible from the account management UI (F2-6) for any account
- Shows all items linked to the account, grouped by type:
  - Transactions (date, description, amount, currency)
  - Properties (name, address)
- Count summary at the top: "N transactions, M properties"
- Each item links through to its detail or edit view
- Does not include items linked to descendant accounts (those are shown
  under their own account's linked-items view)

**Dependencies:** F2-4, F2-6.

---

### F2-8 Account structure versioning `[Future]`
**Status:** Future

Allow a new account structure to be built alongside the existing one,
validated, and activated — archiving the old structure while preserving all
historical data and reports.

**Concept:**
- User builds a new set of accounts while the existing structure remains
  active
- A mapping is defined: each old account maps to an account in the new
  structure
- Validation gate: all old accounts must have a valid mapping before
  activation is permitted
- On activation: old accounts are set to `status = archived`; transaction
  and property links are rewritten to new account IDs per the mapping;
  new accounts become the active structure
- Archived structures remain queryable for historical reporting; reports
  can target either the current or an archived structure

**Dependencies:** F2-4, F2-6, F2-7.

---

### F2-9 Currency rate management `[MVP]`
**Status:** Done

Manage dated bilateral exchange rates at the workspace level.

**Data model:**
- `currency_rates` table: `workspace_id`, `from_currency` (ISO 4217),
  `to_currency` (ISO 4217), `effective_date`, `rate` (decimal),
  `source` (`manual` | `auto`)
- Rates are stored as bilateral pairs — e.g. USD→SGD and SGD→USD are
  separate records
- A rate is valid from its `effective_date` until the next rate entered
  for the same pair; users control the validity window by controlling how
  often they update rates
- Rate lookup rule: most recent rate where `effective_date ≤ transaction date`

**Acceptance criteria:**
- `GET /api/currency-rates` — returns all rates for the workspace, grouped
  by currency pair, ordered by `effective_date` descending
- `POST /api/currency-rates` — creates a rate entry; required:
  `from_currency`, `to_currency`, `effective_date`, `rate`
- `DELETE /api/currency-rates/:id` — removes a rate entry; rejected if
  removing it would leave transactions without a resolvable rate
- UI: rate management table per currency pair showing rate history;
  "Add rate" form; rates are immutable once entered — corrections require
  a new dated entry
- Rate requirement: any transaction in a non-reporting currency must have a
  resolvable rate; transactions without one are rejected at import (F5-5)
  and blocked at manual entry (F3-1)

**Dependencies:** F1-6 (workspace `reporting_currency` setting).

---

### F2-10 Automated currency rate refresh `[Future]`
**Status:** Future — data source not yet selected

Configure the workspace to automatically fetch and insert currency rates
from a public data source on a schedule.

**Acceptance criteria:**
- Workspace settings (F1-6): `rate_refresh_enabled`, `rate_refresh_frequency`
  (e.g. `daily`, `weekly`), `rate_refresh_source` (TBD)
- On schedule, fetches rates for all currency pairs active in the workspace
  and inserts new `currency_rates` rows with `source = auto`
- Failures are logged; workspace owner is notified if auto-refresh has not
  succeeded within twice the configured frequency
- Requires scheduled backend job infrastructure (see E6)

**Open decision:** public API source not yet selected.

**Dependencies:** F2-9, F1-6, E6 scheduled job infrastructure.

---

## Bugs

None recorded.

---

## Dependencies
- `properties` table (created in M2 migrations)
- Auth middleware (M3)
- Accounts schema (F2-3) blocks F2-4 and Epic 3 transaction linking
- Workspace settings (F1-6) — `max_account_depth` and `reporting_currency`

## Notes
- The MVP for accounts is the schema only — the UI can reference properties
  directly until account management UI is built
- Auto-account-per-property is the recommended fallback for simple workspaces
- Account rows are never hard-deleted; `status = archived` is terminal
