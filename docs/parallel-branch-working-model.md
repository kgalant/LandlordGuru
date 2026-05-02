# Parallel Branch Working Model — Design and Change Plan

This document captures the full design for moving to a parallel feature-branch working model,
the reasoning behind each decision, and every file that needs to change. It serves as the
implementation brief for the session(s) that will make these changes.

---

## Why this model

The current model assumes one Claude session, one `AI_STATE.md`, one active feature at a time.
That works for sequential work but breaks down when multiple sessions (or a human and a session)
want to work on independent features in parallel — they conflict on `AI_STATE.md`, on
`version.json`, and potentially on shared docs.

The new model introduces:
- **Two session modes**: planning (on `main`) and coding (on a `feature/*` branch).
- **Git worktrees** so multiple branches can be checked out simultaneously in separate folders.
- **Branch-local `AI_STATE.md`** so each coding session tracks only its own feature.
- **`BRANCHES.md`** on `main` as the shared coordination registry.
- **Guards** (git hooks + Claude Code hooks) to prevent mode violations.

---

## Session modes

### Planning mode — branch: `main`, folder: main repo

Allowed to touch:
- Epic docs (`docs/epics/*.md`)
- `docs/roadmap.md`
- `BRANCHES.md`
- `AI_STATE.md` (main's coordinator version)
- Any other docs/specs

NOT allowed to touch:
- Any code file (`.js`, `.css`, `.html`, backend source, `version.json`)
- Tests

Purpose: specify features, triage bugs, update roadmap, claim features (register in
`BRANCHES.md` and create the worktree), merge ready branches, do version bumps post-merge.

### Coding mode — branch: `feature/<ID>`, folder: worktree

Allowed to touch:
- Code, tests, its own epic doc section (status update only)
- Its branch-local `AI_STATE.md`

NOT allowed to touch:
- `docs/roadmap.md` ordering or other features' entries
- `BRANCHES.md` directly (signal readiness via `AI_STATE.md` only; planning session updates `BRANCHES.md`)
- `version.json` (bumped on `main` after merge, not on the branch)

---

## Worktree structure

```
c:\dev\repos\
  LandlordGuru\               ← main branch  (planning mode)
  LandlordGuru-F3-10\         ← feature/F3-10 (coding mode)
  LandlordGuru-F4-1\          ← feature/F4-1  (coding mode)
```

Worktrees are siblings of the main repo folder. Naming convention: `LandlordGuru-<ID>`.

Commands (run from the main repo folder):

```bash
# Create a worktree for a new feature branch
git worktree add ../LandlordGuru-F3-10 -b feature/F3-10

# List all active worktrees
git worktree list

# Remove after the branch is merged
git worktree remove ../LandlordGuru-F3-10
git branch -d feature/F3-10
```

---

## Version bump policy change

Currently: version is bumped on the feature branch as part of "done".

New policy: **version bumps happen on `main` after a feature branch is merged**, not on the
branch. Two parallel branches would otherwise both bump from the same base version and conflict.

Impact:
- Remove version bump from the feature "done" criteria in `CLAUDE.md`.
- Add version bump as a step in the merge protocol on `main`.
- Update `PROJECT_LANDLORDGURU.md` if it documents the current version bump process.

---

## BRANCHES.md — new file on main

Lives at the root of the main repo. The planning session maintains it; coding sessions read it.

```markdown
# Active Feature Branches

| Branch            | Feature ID | Status             | Worktree path              | Last updated |
|-------------------|------------|--------------------|----------------------------|--------------|
| feature/F3-10     | F3-10      | in_progress        | ../LandlordGuru-F3-10      | 2026-04-27   |
| feature/F4-1      | F4-1       | ready_for_review   | ../LandlordGuru-F4-1       | 2026-04-27   |
```

Status values: `in_progress` | `ready_for_review` | `merged`

Rules:
- A feature must appear in `BRANCHES.md` before any coding session starts on it.
- No two rows may share the same Feature ID.
- Merged rows may be kept for reference but must be marked `merged`.
- The planning session adds rows (when claiming a feature) and updates status (on merge).
- A coding session signals readiness by setting all subtasks `[x]` in its `AI_STATE.md` and
  setting `Next step` to "Notify planning session: ready for review". The planning session
  then updates `BRANCHES.md` to `ready_for_review`.

---

## Changes required to each file

### 1. `CLAUDE.md` — major additions

**a) Core loop — fork on branch**

Replace the single core loop with a branch-aware fork:

```
On session start:
  1. Read PROJECT_LANDLORDGURU.md.
  2. Detect current branch (git branch --show-current).
  3. If branch == main       → follow Planning mode protocol.
  4. If branch == feature/*  → follow Coding mode protocol.
  5. Anything else           → warn the user and stop.
```

**b) Planning mode protocol (new section)**

```
1. Read main's AI_STATE.md (coordinator version).
2. Read BRANCHES.md.
3. Summarise: what is in flight, what is next on the roadmap.
4. Confirm with user: spec a feature, claim a feature, merge a branch, etc.

Claiming a feature:
- Confirm the feature spec is complete in the epic doc.
- Add a row to BRANCHES.md (status: in_progress).
- Run: git worktree add ../LandlordGuru-<ID> -b feature/<ID>
- Tell the user which folder to open for the coding session.

Merging a branch:
- Verify BRANCHES.md row shows ready_for_review.
- Rebase the feature branch onto main: git -C ../LandlordGuru-<ID> rebase main
- Merge: git merge --no-ff feature/<ID>
- Bump version in version.json.
- Remove worktree: git worktree remove ../LandlordGuru-<ID>
- Delete branch: git branch -d feature/<ID>
- Update BRANCHES.md row to merged.
- Commit all of the above together on main.
```

**c) Coding mode protocol (replaces existing core loop)**

```
1. Read PROJECT_LANDLORDGURU.md.
2. Read this branch's AI_STATE.md.
3. Verify: branch name contains the Current focus ID. If not, stop and warn.
4. Summarise: Current focus, Task breakdown, Next step.
5. Confirm with user before starting work.
```

**d) Branch guard rule (new)**

At session start in coding mode, verify:
- `git branch --show-current` matches `feature/<CurrentFocusID>` from `AI_STATE.md`.
- If they don't match: do not touch any file. Tell the user and ask them to check.

**e) Version bump rule (update existing)**

Remove version bump from the feature "done" criteria. Add: "Do not touch `version.json`
on a feature branch. Version is bumped by the planning session on `main` after merge."

**f) Merge readiness criteria (new section)**

A coding session may declare a feature ready for review when:
- All subtasks in Task breakdown are `[x]`.
- Tests pass (validation last result is green).
- Epic doc entry for this feature shows `Status: done`.
- `AI_STATE.md` Next step is set to "Notify planning session: ready for review".

The coding session does NOT merge. It signals readiness. Merging is done by a planning session.

**g) Scope-of-edit rules for shared files (new)**

On a feature branch, when editing a shared doc:
- `docs/epics/*.md`: only update your own feature's entry. Do not reorder or edit other entries.
- `docs/roadmap.md`: do not edit on a feature branch at all.
- `BRANCHES.md`: do not edit on a feature branch at all.

**h) Rebase discipline (new)**

- Cut the feature branch from the latest `main` at creation time.
- Before declaring ready_for_review: rebase onto the current `main`.
- If conflicts arise during rebase: resolve them, do not force-push without telling the user.

---

### 2. `AI_STATE-GUIDE.md` — additions

**a) Add `branch:` field to Current focus**

```
- Branch: feature/F3-10
```

This makes it unambiguous which branch the state belongs to and enables the branch guard check.

**b) Add mode note to the structure section**

Add: "On `main`, `AI_STATE.md` is a coordinator, not a feature tracker. It tracks planning
tasks and what is in flight. On a feature branch, `AI_STATE.md` tracks only that branch's
feature."

**c) Planning mode AI_STATE.md structure (new)**

Define a lighter structure for main's coordinator `AI_STATE.md`:

```
## Goal
## Mode: planning
## Features in flight     ← summary from BRANCHES.md
## Current planning task  ← what this session is doing (speccing, merging, etc.)
## Next step
## Automation log (latest only)
```

---

### 3. `AI_STATE.md` (main) — one-time migration

Once the new model is live, restructure main's `AI_STATE.md` to the coordinator format:
- Remove feature-specific Current focus, Task breakdown, Previous focus.
- Add: `Mode: planning`, `Features in flight` (summary of BRANCHES.md).
- Keep: Goal, Next step, Automation log.

This is done when the first feature branch is cut.

---

### 4. `.claude/hooks/checkpoint.ps1` — fix replace-not-append

**Good news**: the script already uses `git rev-parse --show-toplevel` to find the repo root.
In a git worktree this returns the worktree path, so `AI_STATE.md` resolves correctly to the
worktree's own copy. No path-logic change needed.

**Issue to fix**: the script appends entries unconditionally, but `CLAUDE.md` says only one
Automation log entry should live in `AI_STATE.md`. These two are already in conflict — the
current `AI_STATE.md` has 16+ stale entries as evidence. Fix:

- When writing a new entry, read the existing file, strip everything after `## Automation log`,
  append the new single entry.
- Before stripping, extract the previous entry and append it to `docs/ai_state_archive.json`.
- This makes the archive step automatic and removes the manual cleanup burden from Claude.

This is the highest-priority hook change — it eliminates a recurring source of `AI_STATE.md`
drift that already exists today.

---

### 5. `.claude/settings.json` — additions and fixes

**a) Fix hardcoded permission paths for worktrees**

The existing `allow` entries reference `c:/dev/repos/LandlordGuru/backend`. These won't match
when running from a worktree (`c:/dev/repos/LandlordGuru-F3-10/backend`), so every `npm test`
call in a coding session will prompt for permission approval.

Fix: change the allow patterns to match `LandlordGuru*/backend` or equivalent glob, or add
mirrored entries for the `LandlordGuru-*` path pattern.

**b) New PreToolUse hook: code-on-main guard**

Add a hook that fires before any Edit or Write on `main` and blocks if the target file is a
code file:

```json
{
  "PreToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{
      "type": "command",
      "command": "pwsh -NoProfile -Command \"& (Join-Path (git rev-parse --show-toplevel) '.claude/hooks/guard-main-no-code.ps1') --file '$file'\"",
      "statusMessage": "Checking branch edit permissions"
    }]
  }]
}
```

The guard script exits non-zero (blocking the edit) if:
- Current branch is `main`, AND
- The file is a code file (`.js`, `.css`, `.html`, `.mjs`, under `backend/src/`, etc.)

**c) New PreToolUse hook: version.json guard on feature branches**

Similar guard: block edits to `version.json` if current branch starts with `feature/`.

**d) Archive file permission in worktrees**

The existing `Edit(docs/ai_state_archive.json)` allow entry resolves to the worktree's own
`.claude/` folder, which is correct. No change needed — but verify after first worktree
creation that the permission fires as expected.

---

### 6. New file: `.githooks/pre-commit`

Git hooks in `.githooks/` (committed to the repo, activated via
`git config core.hooksPath .githooks`).

**On `main`:**
- Inspect staged files. If any match a code pattern (`.js`, `.css`, `.html`, `backend/src/`,
  `frontend/js/`, `frontend/css/`), print an error and exit 1.
- Allow: docs, `BRANCHES.md`, `AI_STATE.md`, scripts, `version.json` (post-merge bumps),
  `.claude/`, `.githooks/`.

**On `feature/*`:**
- If `version.json` is staged, print an error and exit 1.
- If `docs/roadmap.md` is staged, print a warning (non-blocking — flag for awareness).

**Activation**: `.githooks/` must be activated per-clone with:
```bash
git config core.hooksPath .githooks
```
Worktrees inherit the parent repo's git config, so this only needs to be set once in the main
clone. Add this command to `docs/SETUP.md`.

---

### 7. New file: `scripts/worktree-check.sh`

A health-check script runnable at any time from the main repo:

```
Usage: bash scripts/worktree-check.sh

Checks performed:
1. Lists all active git worktrees (git worktree list).
2. Reads BRANCHES.md and cross-references: any branch registered but missing a worktree?
   Any worktree not registered in BRANCHES.md?
3. For each active worktree, reads its AI_STATE.md Current focus ID and verifies it matches
   the branch name.
4. Flags any worktree whose branch has already been merged to main.
5. Reports any feature branch that appears to be stale (not rebased recently onto main).

Output: PASS / WARN / FAIL per check with actionable messages.
```

Run this at the start of any session where you're unsure of the world's state, and after
any merge.

---

### 8. `docs/SETUP.md` — additions

Add a section covering:
- How to activate git hooks: `git config core.hooksPath .githooks`
- How to create a coding worktree (naming convention and command)
- How to remove a worktree after merge
- Pointer to `scripts/worktree-check.sh` for health checks

---

### 9. `PROJECT_LANDLORDGURU.md` — version bump reference

Read and update any section that says version is bumped as part of feature completion.
Replace with: "Version is bumped on `main` after a feature branch is merged, by the planning
session."

---

## Things of note

### checkpoint.ps1 and the one-entry rule are already in conflict

The current `AI_STATE.md` has 16+ Automation log entries. The script appends; `CLAUDE.md`
says keep only one. Fixing the script eliminates this as a recurring manual cleanup task and
should be done first, independent of the rest of the parallel model work.

### Hardcoded settings.json paths will break coding sessions immediately

The permission allow list uses `c:/dev/repos/LandlordGuru/backend`. A coding session in a
worktree will hit permission prompts on every `npm test` call. Fix this before the first
coding session or the model will feel broken from the start.

### EnterWorktree / ExitWorktree tools

Claude Code has built-in `EnterWorktree` and `ExitWorktree` tools (visible in the deferred
tool list). These may provide a cleaner interface than raw git commands for creating and
entering worktrees. Worth evaluating during implementation — they may reduce the manual
command burden in the CLAUDE.md planning mode protocol.

### Archive files are worktree-local

Each worktree has its own `.claude/` folder. Branch-local `ai_state_archive.json` files are
not merged back to main — they are transient session artifacts. This is correct behaviour.

### git config core.hooksPath is per-clone, not per-worktree

Setting `core.hooksPath` in the main clone covers all worktrees of that clone, since they
share the same `.git/config`. One activation command covers everything.

### The "one current focus" invariant does not apply to planning mode

Main's coordinator `AI_STATE.md` tracks planning tasks, not coding focus. The strict
one-focus / one-in-progress-subtask discipline applies only in coding mode on feature branches.

---

## Implementation order (suggested)

Steps 1–3 deliver value immediately and are independent of each other.

1. **Fix `checkpoint.ps1`** — replace-not-append + auto-archive. Fixes existing drift now.
2. **Fix `.claude/settings.json` permission paths** — unblocks smooth coding sessions.
3. **Create `.githooks/pre-commit`** — enforces mode boundaries at commit time.
4. **Create `BRANCHES.md`** — establishes the registry (initially empty or with current state).
5. **Create `scripts/worktree-check.sh`** — establishes observability.
6. **Rewrite `CLAUDE.md`** — branch-aware session modes and new protocols. Core change.
7. **Update `AI_STATE-GUIDE.md`** — branch field, mode note, planning mode structure.
8. **Migrate main's `AI_STATE.md`** to coordinator format (one-time, when first branch is cut).
9. **Update `docs/SETUP.md`** — hooks activation, worktree commands.
10. **Check `PROJECT_LANDLORDGURU.md`** — update version bump references.
11. **Add PreToolUse hooks** to `.claude/settings.json` — code-on-main and version.json guards.
