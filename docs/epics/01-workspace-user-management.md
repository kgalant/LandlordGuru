# Epic 1 — Workspace and User Management

## Goal
Allow users to create and manage isolated data spaces (workspaces), invite
collaborators, and control access via roles.

## Status
Partially done — OAuth login, JWT auth, and auto-workspace creation are
complete (M1–M3). Invitation flow and role management are not yet built.

---

## Features

### F1-1 User authentication via Google OAuth `[MVP]`
**Status:** Done

Users log in with their Google account. On first login, a user record and a
default workspace are automatically created.

**Acceptance criteria:**
- Clicking "Sign in with Google" redirects to the Google OAuth consent screen
- On successful login, a JWT is issued in an httpOnly cookie
- If the user has never logged in before, a `users` row and a `workspaces`
  row are created
- The user is assigned the `owner` role in their auto-created workspace
- `primary_workspace_id` on the user record is set to the auto-created
  workspace
- A default account (`is_default = true`, named after the workspace) is
  created in the same database transaction as the workspace — this is the
  fallback account for all operations until the user configures more specific
  accounts

---

### F1-2 Workspace switching `[MVP]`
**Status:** Planned

A user who belongs to multiple workspaces can switch between them in the UI.

**Acceptance criteria:**
- The UI displays the current workspace name
- A dropdown or menu lists all workspaces the user belongs to
- Selecting a workspace updates `primary_workspace_id` on the user record
  and reloads the app in that workspace context
- All data in the UI is scoped to the selected workspace immediately after
  switching

---

### F1-3 User invitation to a workspace `[MVP]`
**Status:** Planned

An owner can invite another person to their workspace by email address.

**Acceptance criteria:**
- Owner enters an email address in the workspace settings UI
- If the email matches an existing user, they are added to `workspace_users`
  with role `member`
- If the email does not match a known user, an invitation record is created
  so that when they first log in with that email they are automatically
  joined to the workspace
- Invited user sees the workspace in their workspace list on next login
- Owner can remove a user from the workspace

---

### F1-4 Workspace creation `[Future]`
**Status:** Future

A user can create additional workspaces beyond the auto-created default.

**Acceptance criteria:**
- UI provides a "New workspace" action
- User enters a workspace name
- A new `workspaces` row is created; user is added as `owner`
- A default account (`is_default = true`) is created in the same database
  transaction as the workspace
- The new workspace is immediately available for switching (see F1-2)

---

### F1-5 Role and permission management `[Future]`
**Status:** Future

Fine-grained per-user permission control within a workspace.

**Acceptance criteria:**
- Owner can assign roles: `owner`, `editor`, `viewer`
- `viewer` role can read data but not create, edit, or delete
- `editor` role can create and edit but not delete or manage users
- `owner` role has full access including user management and workspace
  deletion
- Role is enforced on the backend — not just hidden in the UI

**Dependencies:** F1-3 must be complete first.

---

### F1-7 App header user menu `[MVP]`
**Status:** Planned

The top-right application chrome (user identifier, last-sync timestamp, refresh button, and sign-out link) is replaced by a single avatar icon. Clicking the icon opens a dropdown menu containing all session-related actions. This declutters the header and aligns with standard web application conventions.

**Avatar display:**
- A circle containing the user's initials (first letter of given name + first letter of family name, derived from the authenticated Google profile)
- Future enhancement: replace initials with the Google profile picture once profile-picture fetching is added to the auth flow

**Dropdown menu items (top to bottom):**
- **Sign out** — ends the session, clears the JWT cookie, and redirects to the login page
- **Refresh** — triggers a manual data sync, equivalent to the current standalone refresh button
- **Settings** — navigation link to the workspace settings page (F1-6); renders as disabled with a "Not implemented" tooltip until F1-6 is built
- **Sync info** — non-interactive row showing the last-synced timestamp in muted, small text (e.g. "Synced 3 min ago"); informational only

**Acceptance criteria:**
- The existing SIG/user text, standalone timestamp display, refresh button, and sign-out link are removed from the top-right header area
- An avatar icon (circle with initials) appears in the top-right corner of the authenticated layout
- Clicking the avatar opens the dropdown; clicking anywhere outside the dropdown closes it
- Sign out calls the existing logout endpoint and redirects to the login page
- Refresh triggers the same data refresh as the removed standalone button
- Settings item is visible but non-functional (disabled state + "Not implemented" tooltip) until F1-6 is implemented
- Sync info row shows the last-synced timestamp and is not clickable
- Initials are derived from the logged-in user's display name at runtime

**Dependencies:** F1-1 (auth — done)

---

### F1-6 Workspace settings `[MVP]`
**Status:** Planned

Workspace-level configuration parameters that control system behaviour across
all features.

**Acceptance criteria:**
- `GET /api/workspace/settings` — returns current settings for the active
  workspace
- `PATCH /api/workspace/settings` — updates one or more settings; only
  owners can update
- Initial settings:
  - `reporting_currency` — ISO 4217 currency code used as the base for
    multi-currency display and conversion (e.g. `USD`, `DKK`)
  - `max_account_depth` — maximum allowed depth of the account hierarchy;
    default: `5`; no system ceiling
- Additional settings will be added here as features require them (e.g.
  tenant tracking toggle, rate auto-refresh config)
- Settings are fully scoped to the workspace; different workspaces are
  independent

---

## Bugs

None recorded.

---

## Dependencies
- Google OAuth credentials in Google Cloud Console
  (external setup — see `docs/BACKEND-SETUP.md`)
- `users`, `workspaces`, `workspace_users` tables (created in M2 migrations)

## Notes
- Cross-workspace data isolation is structural — `workspace_id` is injected
  by auth middleware, so queries cannot accidentally leak data across
  workspaces
- The `permissions` JSONB column on `workspace_users` is reserved for future
  granular permissions (F1-5); it is currently null
