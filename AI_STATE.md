# AI State

## Goal

Short 1–2 line statement of the overarching goal.

Example:
"Complete MVP backend + UI for rental tracking (v2), ready for manual end‑to‑end testing in the browser."

---

## Current focus

The single item we are actively working on.

- Type: feature | bug | chore
- Epic: E<epic-number> <epic name>
  - Example: E2 Account and Property Management
- ID: <feature-or-bug-id>
  - Example: F2.1, F3.4, BUG-3.1
- Title: <one-line title>
  - Example: Bulk transaction import endpoint
- Short summary: <1–2 line human-readable description>
  - Example: Implement POST /api/transactions/import for CSV import, with validation and batch rollback support.

---

## Previous focus

If we paused a feature or bug to work on the current focus, record it here so we can resume it later.
If nothing is paused, set this section to `None`.

Example when something is paused:

- Type: feature
- Epic: E3 Transaction Management
- ID: F3.2
- Title: Transaction list UI
- Short summary: Build frontend list view for transactions with filtering and sorting.
- State: paused
- Return point: Resume at S3: Add tests for combined filter and sort scenarios.

---

## Task breakdown (current focus)

Break the current focus into small, concrete subtasks.
Use checkboxes with a strict status convention:

- `[ ]` pending
- `[-]` in_progress
- `[x]` completed

There must be at most **one** `[-]` subtask at any time.

Example:

- [x] S1: Define request/response shape for POST /api/transactions/import.
- [-] S2: Implement validation and all‑or‑nothing batch insert in the backend route.
- [ ] S3: Wire import endpoint into UI and show validation errors.

Status rules:

- Before starting work on a new subtask, move any existing `[-]` to `[x]` (done) or `[ ]` (pending/abandoned), then mark the new one as `[-]`.
- Whenever a subtask’s status changes, update this section in the same response.

---

## Backlog pointers

High‑level pointers only; full details live in the epic docs (01‑*.md, 02‑*.md, 03‑*.md, etc.).

Use IDs here, not full specs.

- Next candidate features (IDs): F2.2, F3.1, F5.4
- Known bugs (IDs): BUG-2.1, BUG-3.1
- Relevant epic docs:
  - docs/01-workspace-user-management.md   (Epic 1)
  - docs/02-account-property-management.md (Epic 2)
  - docs/03-transaction-management.md      (Epic 3)
  - docs/04-reporting-analytics.md         (Epic 4)
  - docs/05-integrations-data-import.md    (Epic 5)

Backlog discipline:

- Backlog items live in epic docs, not here.
- When a new idea or non‑blocking bug comes up during work on the current focus:
  - Ask the user whether to:
    - (a) add it to the backlog under the appropriate epic, or
    - (b) switch the Current focus to it.
  - Only change `Current focus` if the user explicitly chooses (b).

---

## Next step

A single, concrete action that should happen next.

Examples:

- "Run npm test backend/tests/transactions.test.js and fix any failing cases in the import logic."
- "Read data-model.md section on transactions to confirm fields before updating the schema."

Rules:

- Exactly one next step.
- It must be specific enough that you could execute it immediately without more planning.

---

## Validation

Commands and checks that confirm the current focus is in a good state.

- Commands to run:
  - npm test
  - npm start
  - (add any extra commands specific to this focus, e.g. `npm test backend/tests/properties.test.js`)
- Last result:
  - Date/time: <ISO-like timestamp, local time>
    - Example: 2026-04-18 21:45:00
  - Outcome: brief summary
    - Example: "Tests passing, app boots cleanly, manual browser E2E pending."

Whenever a validation command is re‑run, update the Date/time and Outcome here.

---

## Files touched this session

List all files (code + docs + this file) modified in this session.

Examples:

- backend/src/routes/transactions.js
- backend/tests/transactions.test.js
- docs/03-transaction-management.md
- AI_STATE.md

Update this list as you touch files; do not wait until the end of the session.

---

## Automation log (latest only)

Keep exactly **one** automation log entry here.
Older entries are moved into an archive file (for example, `.claude/aistate-archive.json`) by automation.

Format:

- <timestamp> <short label>
  - branch: <git branch>
  - lastcommit: <short commit hash>
  - changedfiles: <comma-separated list of files changed since last commit>
  - gitstatus: <output summary from git status in short form>

Example:

- 2026-04-18 21:45:00 lifecycle
  - branch: main
  - lastcommit: 37d1c30
  - changedfiles: AI_STATE.md, backend/src/routes/transactions.js
  - gitstatus: M AI_STATE.md

Rules:

- On a new automation log entry:
  - Move the previous entry to the archive file.
  - Replace it here with the latest entry only.
- Never accumulate multiple entries in `AI_STATE.md`.

---

## Update and focus-switching rules (for the assistant)

These rules exist so the assistant can use this file correctly without additional instructions.

1. **When to update AI_STATE.md**

   Update this file in the same response whenever you:

   - Break a task into subtasks.
   - Change any subtask status.
   - Switch the Current focus (e.g. from a feature to a bug).
   - Finish the Current focus.
   - Run validation commands.
   - Touch new files.
   - Are about to end the session.

2. **How to switch focus (feature ↔ bug)**

   When a new feature or bug comes up while working on the Current focus:

   - Ask the user:

     "Should we:
      (a) add this as a backlog item under the appropriate epic, or
      (b) switch our Current focus to this item now?"

   - If the user chooses (a):
     - Add an ID’ed entry (e.g. F3.8, BUG-3.2) with a status like `[backlog]` in the relevant epic doc.
     - Do not change the Current focus here.

   - If the user chooses (b):
     - Move the existing Current focus into the Previous focus section, with:
       - Type, Epic, ID, Title, Short summary, and a clear Return point.
     - Set the new item as Current focus and create a fresh Task breakdown.
     - Ensure only one `[-]` subtask is active.

3. **Before stopping a session**

   Before the final response in any session:

   - Move any finished subtasks to `[x]`.
   - Make sure Current focus, Previous focus, Task breakdown, Next step, Validation, and Files touched are all up to date.
   - Write a new Automation log entry (replacing the previous one).
   - The Next step must be a single, concrete action to resume from.
