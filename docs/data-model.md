# Data Model

This document is the authoritative reference for the transaction taxonomy and all field definitions.
It serves as the spec for the future database schema.

---

## Properties

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
| `active`     | boolean | Whether the property is currently in use |

---

## Transactions

| Field             | Type    | Description |
|-------------------|---------|-------------|
| `id`              | string  | Unique identifier, e.g. `tx_1234567890_ab3f` |
| `date`            | date    | ISO 8601 date of the transaction |
| `property_id`     | string  | FK → properties.id |
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
| `property_id`  | string | Property to assign on match, or empty if not deterministic |

Rules are evaluated in order; first match wins.

---

## Strings

UI string overrides — allows per-language and per-user customisation without code changes.
Hardcoded English strings in `js/strings.js` are the fallback; rows in this sheet layer on top.

| Field     | Type   | Description |
|-----------|--------|-------------|
| `key`     | string | Dot-notation key matching the `STRINGS` object in strings.js, e.g. `nav.properties` |
| `lang`    | string | ISO 639-1 language code, e.g. `en`, `da` |
| `user_id` | string | Optional — restricts override to a specific user; empty = applies to all |
| `value`   | string | The replacement string. Supports `{variable}` interpolation. |

Resolution order per key: user-specific sheet row → global sheet row → hardcoded default → English fallback → key itself.

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

## Future database schema notes

When migrating to PostgreSQL:
- `properties` and `transactions` map cleanly to tables of the same name
- `type` and `category` on transactions should be `VARCHAR` with CHECK constraints, not enums, to allow adding categories without a migration
- `amount` should be `NUMERIC(12,2)` — never `FLOAT` for currency
- `import_batch` warrants its own table in v2 to store metadata (import date, file name, row count, who imported)
- `rules` could stay as a config table or move to application code once the category set stabilises
- `strings` maps to a table with a composite unique index on `(key, lang, user_id)`
- Column mappings can remain in localStorage in v2 (they are a UI concern, not a data concern)
