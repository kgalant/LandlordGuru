# Epic 1 — Workspace and User Management

## Goal
Allow users to create and manage isolated data spaces (workspaces), invite collaborators, and control access via roles.

## Status
Partially done — OAuth login, JWT auth, and auto-workspace creation are complete (M1-M3). Invitation flow and role management are not yet built.

---

## Features

### 1.1 User authentication via Google OAuth `[MVP] [Done]`
Users log in with their Google account. On first login, a user record and a default workspace are automatically created.

**Acceptance criteria:**
- Clicking "Sign in with Google" redirects to Google OAuth consent screen
- On successful login, a JWT is issued in an httpOnly cookie
- If the user has never logged in before, a `users` row and a `workspaces` row are created
- The user is assigned the `owner` role in their auto-created workspace
- `primary_workspace_id` on the user record is set to the auto-created workspace
- A default account (`is_default = true`, named after the workspace) is created in the same transaction as the workspace — this is the fallback account for all operations until the user configures more specific accounts

---

### 1.2 Workspace switching `[MVP]`
A user who belongs to multiple workspaces can switch between them within the UI.

**Acceptance criteria:**
- The UI displays the current workspace name
- A dropdown or menu lists all workspaces the user belongs to
- Selecting a workspace updates `primary_workspace_id` on the user record and reloads the app in that workspace context
- All data in the UI is scoped to the selected workspace immediately after switching

---

### 1.3 User invitation to a workspace `[MVP]`
An owner can invite another person to their workspace by email address.

**Acceptance criteria:**
- Owner enters an email address in the workspace settings UI
- If the email matches an existing user, they are added to `workspace_users` with role `member`
- If the email does not match a known user, an invitation record is created so that when they first log in with that email they are automatically joined to the workspace
- Invited user sees the workspace in their workspace list on next login
- Owner can remove a user from the workspace

---

### 1.4 Role and permission management `[Future]`
Fine-grained per-user permission control within a workspace.

**Acceptance criteria:**
- Owner can assign roles: `owner`, `editor`, `viewer`
- `viewer` role can read data but not create, edit, or delete
- `editor` role can create and edit but not delete or manage users
- `owner` role has full access including user management and workspace deletion
- Role is enforced on the backend — not just hidden in the UI

**Dependencies:** 1.3 must be complete first.

---

### 1.5 Workspace creation `[Future]`
A user can create additional workspaces beyond the auto-created default.

**Acceptance criteria:**
- UI provides a "New workspace" action
- User enters a workspace name
- A new `workspaces` row is created; user is added as `owner`
- A default account (`is_default = true`) is created in the same database transaction as the workspace
- The new workspace is immediately available for switching (see 1.2)

---

## Dependencies
- Google OAuth credentials in Google Cloud Console (external setup — see `docs/BACKEND-SETUP.md`)
- `users`, `workspaces`, `workspace_users` tables (created in M2 migrations)

## Notes
- Cross-workspace data isolation is structural — `workspace_id` is injected by auth middleware, so queries cannot accidentally leak data across workspaces
- The `permissions` JSONB column on `workspace_users` is reserved for future granular permissions (1.4); it is currently null
