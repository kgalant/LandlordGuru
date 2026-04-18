# AI_STATE Guide

This file explains how to use `AI_STATE.md`.

- `AI_STATE.md` contains **only live state** (no examples or long instructions).
- This guide holds structure, field definitions, and examples.

---

## Sections in AI_STATE.md (fixed order)

`AI_STATE.md` must always have these sections, in this order:

1. Goal
2. Current focus
3. Previous focus
4. Task breakdown (current focus)
5. Backlog pointers
6. Next step
7. Validation
8. Files touched this session
9. Automation log (latest only)

`CLAUDE.md` defines how the assistant must keep these sections in sync.

---

## 1. Goal

High‑level project goal for the current phase.

- One short paragraph.
- Changes rarely; update when you change milestones.

Example:

> Complete v2 backend + frontend, retire v1 code paths, and pass E2E testing with full CRUD operations working.

---

## 2. Current focus

Exactly one active item the assistant is working on.

Fields:

- Type: `feature` | `bug` | `chore`
- Epic: `E<epic-number> <epic name>` (or `M<number>` for milestones)
- ID: feature or bug ID from the epic docs (e.g. `F2.1`, `F3.4`, `BUG-3.1`)
- Title: one‑line title
- Short summary: 1–2 line description

Example:

- Type: bug  
- Epic: E2 Account and Property Management  
- ID: B2-2-1  
- Title: Dashboard property card display issues  
- Short summary: Fix `null`/`NaN` values in dashboard property card rendering.

---

## 3. Previous focus

Used only when the current item is temporarily paused.

Fields:

- Type, Epic, ID, Title, Short summary (same as Current focus)
- State: `paused`
- Return point: one sentence describing where to resume

If nothing is paused, set this section to `None`.

Example:

- Type: feature  
- Epic: E3 Transaction Management  
- ID: F3.2  
- Title: Transaction list UI  
- Short summary: Build list view for transactions with filtering and sorting.  
- State: paused  
- Return point: Resume at S3: add tests for combined filter + sort scenarios.

---

## 4. Task breakdown (current focus)

Small, concrete subtasks for the Current focus.

Checkbox convention:

- `[ ]` pending
- `[-]` in_progress
- `[x]` completed

Rules:

- At most **one** `[-]` in‑progress subtask at any time.
- Before starting a new subtask:
  - Move any existing `[-]` to `[x]` (done) or `[ ]` (pending/abandoned).
  - Then mark the new one as `[-]`.
- Whenever a subtask changes status, update this section immediately.

Example:

- [x] S1: Define request/response shape for POST `/api/transactions/import`.  
- [-] S2: Implement validation and all‑or‑nothing batch insert in the backend route.  
- [ ] S3: Wire import endpoint into UI and show validation errors.

(For naming: use F<epic>-<number> for features, e.g. F2-1, F3-4; use B<epic>-<feature>-<number> for bugs, e.g. B2-1-1, B3-2-1.)

---

## 5. Backlog pointers

High‑level pointers to future work and known issues.

Rules:

- Use IDs only; full specs live in the epic docs (`docs/01-*.md`, `docs/02-*.md`, etc.).
- Do **not** turn this into a full backlog; keep it short.

Suggested content:

- Next candidate features (IDs)
- Known bugs (IDs)
- Relevant epic docs

Example:

- Next candidate features: `F2-2`, `F3-1`, `F5-4`  
- Known bugs: `B2-1-1`, `B3-1-1`  
- Relevant epic docs:
  - `docs/epics/01-workspace-user-management.md`   (Epic 1)
  - `docs/epics/02-account-property-management.md` (Epic 2)
  - `docs/epics/03-transaction-management.md`      (Epic 3)
  - `docs/epics/04-reporting-analytics.md`         (Epic 4)
  - `docs/epics/05-integrations-data-import.md`    (Epic 5)

Backlog discipline:

- Backlog items live in the epic docs, not in `AI_STATE.md`.
- When a new idea or non‑blocking bug comes up during work:
  - Ask whether to:
    - (a) add it to the backlog under the appropriate epic, or
    - (b) switch Current focus to it.
  - Only change Current focus if the user explicitly chooses (b).

---

## 6. Next step

A single, concrete action that should happen next.

Rules:

- Exactly **one** Next step.
- Must be executable immediately without more planning.
- Should match the `[-]` in‑progress subtask.

Examples:

- Run `npm test backend/tests/transactions.test.js` and fix any failing cases in the import logic.  
- Read `docs/data-model.md` section on transactions to confirm fields before updating the schema.

---

## 7. Validation

Commands and checks that confirm the current focus is in a good state.

Structure:

- Commands to run:
  - `npm test`
  - `npm start`
  - Any extra commands specific to the Current focus
- Last result:
  - Date/time: ISO‑like timestamp (local time), e.g. `2026-04-18 21:45:00`
  - Outcome: brief summary (e.g. “Tests passing, app boots cleanly, manual browser E2E pending.”)

Whenever you re‑run any validation command, update both Date/time and Outcome.

---

## 8. Files touched this session

List all files modified in this session.

Rules:

- Include code, tests, docs, and `AI_STATE.md` itself.
- Update this list **as you touch files**, not at the end.

Example:

- `backend/src/routes/transactions.js`  
- `backend/tests/transactions.test.js`  
- `docs/03-transaction-management.md`  
- `AI_STATE.md`

---

## 9. Automation log (latest only)

Exactly one Automation log entry lives in `AI_STATE.md`.
Older entries go into an archive file (for example: `.claude/ai_state_archive.json`).

Format:

- `<timestamp> <short label>`
  - `branch: <git branch>`
  - `lastcommit: <short commit hash>`
  - `changedfiles: <comma-separated list of files changed since last commit>`
  - `gitstatus: <output summary from git status --short>`

Example:

- 2026-04-18 21:45:00 lifecycle  
  - branch: main  
  - lastcommit: 37d1c30  
  - changedfiles: AI_STATE.md, backend/src/routes/transactions.js  
  - gitstatus: M AI_STATE.md

Rules:

- On a new Automation log entry:
  - Move the previous entry into the archive file.
  - Replace the entry in `AI_STATE.md` with the new one.
- Never accumulate multiple Automation log entries in `AI_STATE.md`.

---

## Assistant behaviour (summary)

Details of how Claude must behave are defined in `CLAUDE.md`, but the key expectations are:

- Always read `AI_STATE.md` at session start and before stopping.  
- Never leave `AI_STATE.md` stale for more than one response turn.  
- Maintain:
  - Exactly one Current focus
  - At most one `[-]` in‑progress subtask
  - Exactly one Next step

If these invariants are broken, Claude must fix `AI_STATE.md` before doing more work.