# Epic 6 — Tags & Rules

## Goal
Allow users to attach freeform workspace-level tags to transactions for cross-cutting reporting (e.g. by contractor, project, or cost centre). Tags are complementary to categories and types: a transaction has exactly one type and category, but can have zero or many tags. Tags can be applied manually in the transaction modal or automatically via a rules engine.

## Status
Planned. No implementation exists yet.

---

## Features

### F6-1 Tags data model `[Post-MVP]`
**Status:** Backlog

Introduce the tags table and the transaction–tag join table.

**Schema:**
- `tags` table: `id` (UUID PK), `workspace_id` (FK → workspaces), `name` (varchar, unique within workspace), `created_at`, `created_by`
- `transaction_tags` join table: `(transaction_id, tag_id)` composite PK; `created_at`, `created_by`
- `tags.name` is case-insensitive unique per workspace (normalise to lowercase on write)
- No maximum number of tags per transaction

**Migration:** New migration file adding both tables.

**Dependencies:** `transactions` table (M2), `workspaces` table

---

### F6-2 Tags CRUD API `[Post-MVP]`
**Status:** Backlog

REST endpoints for managing tags and attaching/detaching them from transactions.

**Acceptance criteria:**
- `GET /api/tags` — returns all tags for the workspace, sorted by name
- `POST /api/tags` — creates a tag; required: `name`; returns the created tag
- `DELETE /api/tags/:id` — deletes tag and removes all `transaction_tags` rows for it
- `POST /api/transactions/:id/tags` — body: `{ tag_id }` — attaches a tag; idempotent
- `DELETE /api/transactions/:id/tags/:tag_id` — detaches a tag
- `GET /api/transactions/:id` response includes `tags: [{ id, name }]`
- `GET /api/transactions` response includes `tags` array per row

**Dependencies:** F6-1 (schema), F3-1 (transactions API)

---

### F6-3 Inline tag management in transaction modal `[Post-MVP]`
**Status:** Backlog

Let users attach and detach tags from a transaction directly in the edit modal, with autocomplete and inline tag creation.

**Acceptance criteria:**

**Display:**
- A "Tags" section appears in the transaction edit modal below the existing fields
- Currently applied tags are shown as dismissible badge chips (tag name + ×)
- Clicking × on a badge removes that tag from the transaction (calls `DELETE /api/transactions/:id/tags/:tag_id`)

**Adding tags:**
- A text input below the badges supports autocomplete: as the user types, matching workspace tags are shown in a dropdown (case-insensitive prefix or substring match)
- Selecting a suggestion attaches the tag immediately
- If the typed value matches no existing tag, the dropdown shows "Create tag 'X'" — confirming creates the tag (calls `POST /api/tags`) then attaches it
- Tags are attached immediately on selection (no need to save the modal first); detaching is also immediate

**UX pattern:** similar to hashtag/label inputs on social platforms — type, pick or create, see badges.

**Dependencies:** F6-2 (tags API), F3-10 (transaction edit modal host)

---

### F6-4 Rules engine for auto-tagging `[Post-MVP]`
**Status:** Backlog

Allow users to define rules that automatically apply tags to transactions based on field conditions. Rules are evaluated at import time and when a transaction is edited.

**Rule model:**
- A rule has: one or more conditions (`field`, `operator`, `value`) and one or more tags to apply
- Conditions: `AND` logic within a rule (all conditions must match)
- Fields available for conditions: `description` (contains / equals), `amount` (>, <, =), `type` (equals), `category` (equals), `property_id` (equals)
- Operators: `equals`, `contains` (case-insensitive), `greater_than`, `less_than`

**Schema:**
- `tagging_rules` table: `id`, `workspace_id`, `name` (user label), `conditions` (JSONB array of `{field, operator, value}`), `created_at`, `created_by`
- `tagging_rule_tags` join table: `(rule_id, tag_id)` — tags to apply when rule matches

**Evaluation:**
- On `POST /api/transactions/import` — rules evaluated for each row before insert; matched tags applied
- On `PATCH /api/transactions/:id` — rules re-evaluated after save; matched tags applied (existing manually-applied tags are preserved; only rule-suggested tags are added/removed)
- Rules do not remove manually-applied tags; they only add

**UI (rule management):**
- Rules list in a dedicated settings section (or within transaction settings)
- Create/edit rule: name, condition builder (field + operator + value rows), tag picker
- Rules can be enabled/disabled without deleting

**Dependencies:** F6-1 (schema), F6-2 (tags API), F3-4 (import endpoint — evaluation hook)

---

### F6-5 Tag filter in transaction list `[Post-MVP]`
**Status:** Backlog

Add a multi-select tag filter to the transaction list, so users can filter to transactions with any/all of a set of tags.

**Acceptance criteria:**
- A "Tags" multi-select filter control appears in the transaction filter bar
- Filter mode: "any of" — shows transactions that have at least one of the selected tags
- Empty selection = no tag filter applied
- `GET /api/transactions` accepts `tag_id` as a repeatable param (OR logic across values)
- The DataTable multi-select filter type (F3-15) is used for this control

**Dependencies:** F6-2 (tags API), F3-15 (multi-select filter type), F3-2 (filter bar host)

---

### F6-6 Tags as a group-by dimension `[Post-MVP]`
**Status:** Backlog

Allow tags to be used as a grouping level in the transaction list Group by feature (F3-13).

**Acceptance criteria:**
- "Tag" appears as an option in the Group by dropdown (F3-13)
- Transactions with multiple tags appear in each of their tag groups
- Transactions with no tags appear in a "No tag" group at the bottom
- Currency sums work the same as other group-by dimensions

**Note:** A transaction appearing in multiple tag groups means the same row contributes to multiple group sums. This is intentional and matches the expected behaviour for tags (cross-cutting labels).

**Dependencies:** F3-13 (group-by feature), F6-1 (tags schema), F6-2 (tags API)

---

## Dependencies

- F6-1 must be done before any other F6 feature
- F6-2 must be done before F6-3, F6-4, F6-5, F6-6
- F3-15 (multi-select filter type) required for F6-5
- F3-13 (group-by) required for F6-6

## Notes
- Tags are workspace-scoped, not user-scoped; all users in a workspace share the same tag library.
- Tag names are normalised to lowercase. Display may capitalise but storage is lowercase.
- The rules engine (F6-4) never removes manually-applied tags; it only adds rule-suggested ones.
