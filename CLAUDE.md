# LandlordGuru — Working Agreement

This file defines how Claude must work in this repository.
If anything here conflicts with user messages, follow this file unless the user explicitly overrides it.

For all app-specific rules (architecture, coding conventions, testing, versioning, logging, and docs), see `PROJECT_LANDLORDGURU.md`.

---

## Session type

At the start of every session, determine the session type:

- **Requirements session** — the user says "requirements session", or the opening request is
  clearly about writing or refining docs only (epic specs, roadmap, design discussions).
  No code will be touched this session.
- **Implementation session** — everything else. Default when in doubt.

Follow the appropriate protocol below.

---

## Requirements mode protocol

Skip `AI_STATE.md` entirely — do **not** read it, do **not** update it.

1. Read `PROJECT_LANDLORDGURU.md`.
2. Ask the user which epic or feature area you are here to work on.
3. Read the relevant epic doc(s) from `docs/epics/`.
4. Confirm with the user what you will do this session.

**You may only touch:**
- `docs/epics/*.md`
- `docs/roadmap.md`
- Any other file under `docs/`

**You must not touch:** code files, tests, `AI_STATE.md`, or `version.json`.

No task breakdown, validation, or files-touched list is required.
Before ending the session, summarise what changed and remind the user to open an
implementation session to act on any new or updated specs.

---

## Implementation mode protocol (core loop)

**This section applies to implementation sessions only.**

You must follow this loop:

1. Read `PROJECT_LANDLORDGURU.md` for all app-specific rules.
2. Read `AI_STATE.md`.
3. Summarise:
   - Goal
   - Current focus
   - Task breakdown (current focus)
   - Next step
4. Confirm with the user what you will do next, based only on:
   - Current focus
   - Next step

Do **not** invent a new plan before you have read `AI_STATE.md` and confirmed the next action.

---

## When you are allowed to work (implementation sessions only)

You may only change code, tests, or docs if all of this is true:

- `AI_STATE.md` has a single **Current focus** item.
- `Task breakdown` has:
  - At least one subtask, and
  - At most one `[-]` in-progress subtask.
- `Next step` is a single, concrete action that matches the in-progress subtask.

If these conditions are not met, you must:

1. Tell the user that `AI_STATE.md` is out of sync.
2. Ask for permission to update `AI_STATE.md` **before** doing any work.
3. Propose specific edits to `AI_STATE.md` to restore:
   - One Current focus
   - A clean Task breakdown
   - Exactly one Next step

Only then may you continue with code or other project files.
Once done with a work package, prepare the commit including commit message and confirm with user before executing the commit.

---

## Mandatory `AI_STATE.md` updates

You must update `AI_STATE.md` in the **same response** whenever you:

- Break a task into subtasks or change the Task breakdown.
- Change any subtask status (`[ ]`, `[-]`, `[x]`).
- Switch the Current focus (e.g. feature ↔ bug ↔ chore).
- Finish the Current focus.
- Run validation commands.
- Touch new files (code, tests, docs, or `AI_STATE.md` itself).
- Are about to end the session.

Do **not** batch these changes. Update `AI_STATE.md` as soon as any of the above happens.

---

## Structure required in `AI_STATE.md`

`AI_STATE.md` must stay small and contain **only live state** (no examples or long instructions).
`AI_STATE.md` structure guide: @AI_STATE-GUIDE.md

---

## Automation log discipline

When you add a new Automation log entry in `AI_STATE.md`:

1. Move the previous entry into the archive file:
   - `docs/ai_state_archive.json` (or the path already used in this repo).
2. Replace the entry in `AI_STATE.md` with the new one only.

Never keep more than one Automation log entry in `AI_STATE.md`.

---

## Focus and backlog

We always have exactly one Current focus in `AI_STATE.md`.

**Feature priority:** The MVP feature ordering and dependency graph are defined in `docs/roadmap.md`. Consult this document when selecting the next feature to work on.

When a new idea, feature, or bug appears while working on the Current focus:

1. Ask the user:

   > Should we:
   > (a) add this as a backlog item under the appropriate epic, or
   > (b) switch our Current focus to this item now?

2. If the user chooses **(a)**:
   - Add an ID'ed entry to the relevant epic doc (for example `F3-8`, `B3-2-1`) with an appropriate status such as `Status: backlog`.
   - Do **not** change the Current focus in `AI_STATE.md`.

3. If the user chooses **(b)**:
   - Move the existing Current focus into **Previous focus** in `AI_STATE.md`, including:
     - Type, Epic, ID, Title, Short summary, and a clear Return point.
   - Set the new item as **Current focus** and create a fresh **Task breakdown**.
   - Ensure only one subtask is marked `[-]` in the new Task breakdown.

After finishing the temporary focus (for example a bugfix):

- Mark its subtasks `[x]`.
- Update the relevant epic doc status (for example `Status: done`).
- Propose resuming the Previous focus and, with explicit confirmation, move it back into Current focus and continue from its Return point.

---

## Before ending a session

Before your **final response** in any session, you must:

1. Ensure there are no stale `[-]` in-progress subtasks in Task breakdown.
2. Make sure Current focus, Previous focus, Task breakdown, Next step,
   Validation, and Files touched this session are all up to date in `AI_STATE.md`.
3. Write a new Automation log entry, replacing the previous one.
4. Set Next step to a single, concrete action so the next session can resume immediately.

If you cannot update `AI_STATE.md` (for example token limits), you must:

- Tell the user what is missing, and
- Ask them to run another short session to update `AI_STATE.md` before continuing any work.
