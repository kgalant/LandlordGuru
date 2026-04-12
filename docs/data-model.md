# Data Model

This document is the authoritative reference for the transaction taxonomy and all field definitions.
It serves as the spec for the future database schema.

---

## Apartments

| Field        | Type    | Description |
|--------------|---------|-------------|
| `id`         | string  | Unique identifier, e.g. `apt_1234567890` |
| `name`       | string  | Short display name, e.g. `VB77 1tv` |
| `address`    | string  | Full address |
| `country`    | string  | ISO 3166-1 alpha-2, e.g. `DK`, `PL` |
| `currency`   | string  | ISO 4217, e.g. `DKK`, `PLN` |
| `model`      | string  | `longterm` or `airbnb` |
| `rent`       | number  | Monthly rent in local currency |
| `aconto`     | number  | Monthly a/c heating & water in local currency |
| `tenant`     | string  | Tenant name (long-term) |
| `lease_start`| date    | ISO 8601 date |
| `notes`      | string  | Free text |
| `active`     | boolean | Whether the apartment is currently in use |

---

## Transactions

| Field             | Type    | Description |
|-------------------|---------|-------------|
| `id`              | string  | Unique identifier, e.g. `tx_1234567890_ab3f` |
| `date`            | date    | ISO 8601 date of the transaction |
| `apartment_id`    | string  | FK → apartments.id |
| `type`            | string  | Top-level type: `income`, `expense`, `deposit`, `transfer` |
| `category`        | string  | Subcategory (see taxonomy below) |
| `amount`          | number  | Absolute value in local currency (always positive) |
| `currency`        | string  | ISO 4217 |
| `description`     | string  | Human-readable description (may be edited from bank text) |
| `raw_description` | string  | Original bank export text, never edited |
| `source`          | string  | `manual`, `jyske_bank`, `nordea_dk`, `mbank_pl`, `generic_csv` |
| `import_batch`    | string  | Batch ID grouping all rows from one import run, e.g. `import_1234567890` |
| `notes`           | string  | Free text annotation; required when category is `other_expense` |
| `reconciled`      | boolean | Manually marked as verified against a statement |
| `created_at`      | datetime| ISO 8601 datetime, set at write time |

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

## Rules

Auto-categorisation rules applied at CSV import time.

| Field          | Type   | Description |
|----------------|--------|-------------|
| `bank_profile` | string | Applies only to this bank profile, or empty for any |
| `keyword`      | string | Case-insensitive substring match against transaction description |
| `category`     | string | Category to assign on match |
| `apartment_id` | string | Apartment to assign on match, or empty if not deterministic |

Rules are evaluated in order; first match wins.

---

## FX log

Snapshot of exchange rates for audit purposes. Not used for bookkeeping.

| Field           | Type   | Description |
|-----------------|--------|-------------|
| `date`          | date   | Date of the rate snapshot |
| `from_currency` | string | ISO 4217 |
| `to_currency`   | string | ISO 4217 |
| `rate`          | number | Units of `from` per 1 unit of `to` |
| `source`        | string | How the rate was obtained, e.g. `manual`, `ecb` |

---

## Future database schema notes

When migrating to PostgreSQL:
- `apartments` and `transactions` map cleanly to tables of the same name
- `type` and `category` on transactions should be `VARCHAR` with CHECK constraints, not enums, to allow adding categories without a migration
- `amount` should be `NUMERIC(12,2)` — never `FLOAT` for currency
- `import_batch` warrants its own table in v2 to store metadata (import date, file name, row count, who imported)
- `rules` could stay as a config table or move to application code once the category set stabilises
