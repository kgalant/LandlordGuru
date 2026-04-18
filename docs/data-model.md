# Data Model

This document is the authoritative reference for all database tables, fields, and the transaction taxonomy.

**Current status:** This is the v2 PostgreSQL schema (in production). Defined by Knex.js migrations in `backend/src/db/migrations/`.

---

## Core (Workspace & Auth)

### Workspaces

Multi-tenant isolation: each workspace is a completely isolated portfolio.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `name`               | varchar   | Workspace display name |
| `created_at`         | timestamp | Set on creation, default `now()` |
| `created_by`         | UUID      | FK → users.id; null if auto-created |
| `last_modified_at`   | timestamp | Updated on any change, default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; null if auto-created |

### Users

Google OAuth identities, one per email address.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `email`              | varchar   | Unique; used for Google OAuth matching |
| `name`               | varchar   | Display name (from Google profile) |
| `google_id`          | varchar   | Unique; Google OAuth subject ID |
| `avatar_url`         | varchar   | Profile picture URL (from Google) |
| `primary_workspace_id`| UUID     | FK → workspaces.id; user's default workspace on login; nullable (set NULL if workspace deleted) |
| `created_at`         | timestamp | Set on first OAuth login |
| `last_modified_at`   | timestamp | Updated on profile refresh |
| `last_modified_by`   | UUID      | FK → users.id; self-reference, nullable |

### Workspace_users

Role and permission assignment. Composite primary key: `(workspace_id, user_id)`.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `workspace_id`       | UUID      | Composite PK; FK → workspaces.id (CASCADE delete) |
| `user_id`            | UUID      | Composite PK; FK → users.id (CASCADE delete) |
| `role`               | varchar   | `owner`, `editor`, `viewer`, `member` — default `member` |
| `permissions`        | jsonb     | Reserved; currently null; future per-user granular permissions |
| `joined_at`          | timestamp | When user was added to this workspace; default `now()` |
| `created_by`         | UUID      | FK → users.id; who invited this user; null if auto-created |
| `last_modified_at`   | timestamp | Updated when role/permissions change; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; null if auto-created |

---

## Data Tables

### Properties

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); indexed |
| `name`               | varchar   | Short display name, e.g. `VB77 1tv` |
| `address`            | text      | Full address |
| `country`            | varchar(2)| ISO 3166-1 alpha-2, e.g. `DK`, `PL` |
| `currency`           | varchar(3)| ISO 4217, e.g. `DKK`, `PLN` |
| `model`              | varchar   | `longterm` or `airbnb` |
| `rent`               | decimal(12,2) | Monthly rent in local currency |
| `aconto`             | decimal(12,2) | Monthly a/c heating & water in local currency |
| `tenant`             | varchar   | Tenant name (long-term) |
| `lease_start`        | date      | ISO 8601 date |
| `notes`              | text      | Free text |
| `active`             | boolean   | Whether the property is currently in use; default `true` |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; who created this property; nullable |
| `last_modified_at`   | timestamp | Updated on any change; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; nullable |

**Indexes:** `(workspace_id)`

---

### Accounts

A flexible accounting container that bridges properties and transactions. An account is the unit of accounting — transactions belong to accounts, not directly to properties.

**Simple case:** One property → one account (auto-created when the property is created). The user never has to think about accounts.

**Complex case:** Multiple properties in the same building → one account covering all of them. Transactions are assigned to the account; property-level reporting joins through `account_properties`.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); indexed |
| `name`               | varchar   | Display name, e.g. `VB77` or `Maple Street Building` |
| `notes`              | text      | Free text |
| `active`             | boolean   | Whether the account is in use; default `true` |
| `is_default`         | boolean   | True for the workspace's default catch-all account; default `false` |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; nullable |
| `last_modified_at`   | timestamp | Updated on any change; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; nullable |

**Indexes:** `(workspace_id)`

**Unique constraint:** `(workspace_id) WHERE is_default = true` — at most one default account per workspace (partial unique index).

**Default account rule:** When a workspace is created, one account is automatically created with `is_default = true` and named after the workspace. This account is the fallback used wherever an account is required but the user has not yet set up specific accounts or assigned a transaction to one. Every subsequent decision that needs "which account?" should resolve to this default when nothing more specific is available — not to null, not to an error.

---

### Account_properties

Join table linking accounts to properties. Composite primary key: `(account_id, property_id)`.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `account_id`         | UUID      | Composite PK; FK → accounts.id (CASCADE delete) |
| `property_id`        | UUID      | Composite PK; FK → properties.id (CASCADE delete) |

**To look up all transactions for a specific property:**
```sql
SELECT t.*
FROM transactions t
JOIN account_properties ap ON ap.account_id = t.account_id
WHERE ap.property_id = :property_id
  AND t.workspace_id = :workspace_id
```

---

### Transactions

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); indexed with date and account_id |
| `date`               | date      | ISO 8601 date of the transaction |
| `account_id`         | UUID      | FK → accounts.id; nullable (allows workspace-level transactions not tied to any account) |
| `type`               | varchar   | Top-level type: `income`, `expense`, `deposit`, `transfer` |
| `category`           | varchar   | Subcategory (see taxonomy below) |
| `amount`             | decimal(12,2) | Absolute value in local currency (always positive) |
| `currency`           | varchar(3)| ISO 4217 |
| `description`        | text      | Human-readable description (may be edited from bank text) |
| `raw_description`    | text      | Original bank export text, never edited |
| `source`             | varchar   | `manual`, `jyske_bank`, `nordea_dk`, `mbank_pl`, `generic_csv` |
| `import_batch`       | varchar   | Batch ID grouping all rows from one import run; indexed separately |
| `notes`              | text      | Free text annotation; required when category is `other_expense` |
| `reconciled`         | boolean   | Manually marked as verified against a statement; default `false` |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; who imported/created this transaction; nullable |
| `last_modified_at`   | timestamp | Updated on any edit; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; nullable |

**Indexes:** `(workspace_id)`, `(workspace_id, date)`, `(workspace_id, account_id)`, `(import_batch)`

### Sign convention

`amount` is always stored as a positive number. The sign (money in vs money out) is
encoded in `type` and `category`:
- `income` → money received
- `expense` → money paid out
- `deposit` → money held (direction encoded in category: `deposit_received` vs `deposit_returned`)
- `transfer` → neutral movement between own accounts

---

## Category taxonomy

### Income

| Category key         | Label                    | Notes |
|----------------------|--------------------------|-------|
| `rent`               | Rent                     | Monthly rent payment received |
| `heating_aconto`     | Heating & water (a/c)    | A/c contribution collected alongside rent |
| `heating_settlement` | Heating settlement       | Year-end reconciliation — can be positive (refund to tenant) or negative (top-up from tenant) |

### Expense

| Category key         | Label                    | Notes |
|----------------------|--------------------------|-------|
| `maintenance_repair` | Maintenance & repair     | |
| `property_tax`       | Property tax             | Danish: ejendomsskat |
| `insurance`          | Insurance                | Building or contents insurance |
| `utilities`          | Utilities                | Only if paid directly by owner |
| `management_fee`     | Management fee           | Property management company fees |
| `advertising`        | Advertising              | Listing costs |
| `professional_fees`  | Professional fees        | Accountant, lawyer, etc. |
| `bank_charges`       | Bank charges             | Transfer fees, currency conversion costs |
| `other_expense`      | Other expense            | Requires a note explaining the expense |

### Deposit

| Category key         | Label                    | Notes |
|----------------------|--------------------------|-------|
| `deposit_received`   | Deposit received         | Deposit paid by tenant at lease start |
| `deposit_returned`   | Deposit returned         | Deposit refunded at lease end |

### Transfer

| Category key         | Label                    | Notes |
|----------------------|--------------------------|-------|
| `inter_account`      | Inter-account transfer   | Moving funds between own accounts; excluded from P&L |

---

### Rules

Auto-categorisation rules applied at CSV import time. Rules are evaluated in order of `sort_order`; first match wins.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); indexed |
| `bank_profile`       | varchar   | Applies only to this bank profile; null = applies to any profile |
| `keyword`            | varchar   | Case-insensitive substring match against transaction description |
| `category`           | varchar   | Category to assign on match (see taxonomy below) |
| `property_id`        | UUID      | FK → properties.id; nullable if not deterministic |
| `sort_order`         | integer   | Evaluation order; default `0` (lower = first) |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; who created this rule; nullable |
| `last_modified_at`   | timestamp | Updated on any change; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; nullable |

**Indexes:** `(workspace_id)`

---

### Strings

UI string overrides — allows per-language and per-user customisation without code changes.
Hardcoded English strings in `js/strings.js` are the fallback; rows in this table layer on top.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); part of unique constraint; indexed |
| `key`                | varchar   | Dot-notation key matching the `STRINGS` object in strings.js, e.g. `nav.properties`; part of unique constraint |
| `lang`               | varchar   | ISO 639-1 language code, e.g. `en`, `da`; part of unique constraint |
| `user_id`            | UUID      | Optional FK → users.id; restricts override to a specific user; null = applies to all; part of unique constraint |
| `value`              | text      | The replacement string. Supports `{variable}` interpolation. |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; who created this override; nullable |
| `last_modified_at`   | timestamp | Updated on any change; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; nullable |

**Unique constraint:** `(workspace_id, key, lang, user_id)`

**Indexes:** `(workspace_id)`

**Resolution order:** workspace-specific, user-specific row → workspace-specific, global row → hardcoded default in frontend → English fallback → key itself

---

### FX Log

Snapshot of exchange rates for audit purposes. Not used for bookkeeping — informational only.

| Field                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `workspace_id`       | UUID      | FK → workspaces.id (CASCADE delete); indexed |
| `date`               | date      | Date of the rate snapshot |
| `from_currency`      | varchar(3)| ISO 4217 |
| `to_currency`        | varchar(3)| ISO 4217 |
| `rate`               | decimal(12,6) | Units of `from` per 1 unit of `to` |
| `source`             | varchar   | How the rate was obtained, e.g. `manual`, `ecb`, `alphavantage` |
| `created_at`         | timestamp | Set on creation; default `now()` |
| `created_by`         | UUID      | FK → users.id; who recorded this rate; nullable |
| `last_modified_at`   | timestamp | Updated if corrected; default `now()` |
| `last_modified_by`   | UUID      | FK → users.id; who made the last change; nullable |

**Indexes:** `(workspace_id)`

---

## Description mappings (client-side only)

Named description-to-category mappings captured at import time. Stored in `localStorage`
under the key `lg_desc_mappings_v1`. Structure is an array that maps directly to a future
DB table. Composite unique key: `(bank_profile, user_id, keyword)` — upsert on save.

```json
[
  {
    "bank_profile": "jyske_bank",
    "user_id":      "",
    "keyword":      "RICHARD SABUMBA HUSLEJE",
    "category":     "rent",
    "updated_at":   "2026-04-12T10:00:00.000Z"
  }
]
```

`user_id` is empty string for now; will be populated once user auth is introduced.
`bank_profile` can be empty to match any profile.

Priority when applying at preview time:
1. User-specific description mapping (`user_id` matches current user)
2. Global description mapping (`user_id` is empty)
3. Rules from the Rules sheet
4. Default (rent if positive amount, other_expense if negative)

---

## Column mappings (client-side only)

Named CSV column mappings are stored in `localStorage` under the key `lg_col_mappings_v1`.
They are never persisted to the sheet — they are per-browser/device. Structure:

```json
{
  "Jyske Bank — main account": {
    "delimiter": ";",
    "skip_rows": 1,
    "date_col": 0,
    "description_col": 2,
    "amount_col": 3,
    "date_format": "DD.MM.YYYY",
    "amount_decimal": ",",
    "currency": "DKK"
  }
}
```

---

## Notes on design decisions

### Audit fields

All tables carry `created_at`, `created_by`, `last_modified_at`, `last_modified_by`. These are automatically set/updated:
- On INSERT: `created_at` and `last_modified_at` default to `now()`; backend code must set `created_by` and `last_modified_by` to the authenticated user ID
- On UPDATE: backend code explicitly updates `last_modified_at` and `last_modified_by`; other fields never auto-update

This allows a complete audit trail: who made each change, and when.

### Amount precision

`amount` and `rate` use `DECIMAL` (base-10), never `FLOAT`:
- `DECIMAL(12,2)` for currency amounts (12 digits total, 2 after decimal point; up to 10 digits of currency)
- `DECIMAL(12,6)` for exchange rates (supports rates up to 999999.999999)

### Workspace isolation

All data tables carry `workspace_id`. Auth middleware injects this from the JWT, so cross-workspace access is structurally impossible at the query level — no need for runtime checks.

When a workspace is deleted, all its data cascades (properties, transactions, rules, fx_log, strings, workspace_users entries).

When a user is deleted, their FK references (`created_by`, `last_modified_by`) set to NULL, preserving the audit trail.

### Client-side storage (unchanged from v1)

These remain in browser `localStorage` and are never persisted to the database:
- Column mappings: `lg_col_mappings_v1` (CSV import preferences)
- Description mappings: `lg_desc_mappings_v1` (manually captured category hints)

They are per-browser/device and sync'ed via the UI, not stored on the server yet.
