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
or more properties to transactions, allowing workspaces to organise according
to their needs:
- A single-property landlord can have one account (simple case)
- A multi-property landlord with several units in one building can account
  for them as a single entity
- A set of accounts is configured in a certain way per workspace. All workspace users utilise the same account structure.

Accounts are **optional complexity**. The system must work for users who
never think about accounts.

**Default workspace account:** Every workspace has exactly one
`is_default = true` account, created automatically when the workspace is
created. It is the catch-all for any operation that needs "which account?"
when nothing more specific applies.

**Account resolution order** (for any operation that needs "which account?"):
1. Explicitly selected account (user picked one in the UI)
2. Auto-created account linked to the selected property (via
   `account_properties`)
3. Workspace default account (`is_default = true`)

---

## Features

### F2-1 Property CRUD `[MVP]`
**Status:** Planned

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

---

### F2-2 Property list UI `[MVP]`
**Status:** Planned

Frontend view showing all active properties with key fields.

**Acceptance criteria:**
- Lists all active properties returned by `GET /api/properties`
- Shows: name, address, tenant, model, rent, currency
- "Add property" button opens a form (F2-1)
- Clicking a property opens its detail/edit view
- Archived properties are hidden by default; an option reveals them

---

### F2-3 Account model `[MVP]`
**Status:** Schema done

Accounts and their relationship to properties are defined in
`008_accounts.js`.

**Decision (confirmed):**
- An account has a name and belongs to a workspace
- An account links to one or more properties via the `account_properties`
  join table
- `transactions.property_id` is replaced by `transactions.account_id` —
  transactions are an accounting event and belong to an account, not
  directly to a property
- On property creation, the backend auto-creates a matching account and
  links them — simple workspaces never need to think about accounts

**Schema:**
- `accounts` table: `id`, `workspace_id`, `name`, `notes`, `active`, audit
  fields
- `account_properties` join table: `(account_id, property_id)` composite PK
- `transactions.account_id` FK → `accounts.id` (nullable; replaces
  `property_id`)

**To query transactions for a specific property:** join
`transactions → account_properties` on `account_id`, filter by `property_id`.

---

### F2-4 Account CRUD `[MVP]`
**Status:** Planned

Create, view, edit, and archive accounts.

**Acceptance criteria:**
- `GET /api/accounts` — returns all accounts in the workspace
- `POST /api/accounts` — creates an account; required: `name`
- `PATCH /api/accounts/:id` — updates name or notes
- `DELETE /api/accounts/:id` — soft delete
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

## Bugs

None recorded.

---

## Dependencies
- `properties` table (created in M2 migrations)
- Auth middleware (M3)
- Accounts schema (F2-3) blocks F2-4 and Epic 3 transaction linking

## Notes
- The MVP for accounts is the schema only — the UI can reference properties
  directly until account management UI is built
- Auto-account-per-property is the recommended fallback for simple workspaces
