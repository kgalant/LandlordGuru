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

### F1-8 Workspace administration `[Future]`
**Status:** Future

System-level workspace management interface for users with the `workspace_manager` role. The workspace manager role is global and not tied to any specific workspace; users with this role can create, view, edit, and delete workspaces across the entire system.

**Workspace manager role:**
- A new role type in the system (distinct from workspace-scoped roles like `owner`, `editor`, `viewer`)
- Not tied to any specific workspace; confers system-wide workspace administration privileges
- Users with this role see a "Workspace Management" option in their avatar menu (see F1-7)

**Workspace Management UI page:**

The page is accessible only to users with the `workspace_manager` role and provides:

1. **Create workspace form:**
   - Input field for workspace name
   - Input field for default admin email (mandatory)
   - On submission:
     - Creates a new `workspaces` row with the provided name
     - Creates a default account (`is_default = true`) in that workspace
     - Adds the provided email as the owner of the workspace (creates a `workspace_users` row with role `owner`)
     - Handles any other initial workspace setup tasks (e.g. setting default currency, max account depth)
   - Confirmation message on success

2. **View all workspaces:**
   - List all workspaces in the system (not filtered by the current user's access)
   - Display workspace name, creation date, owner email(s), number of users
   - Sortable and filterable by name or date

3. **Edit workspace details:**
   - Update workspace name and other metadata
   - Only admins can perform this action
   - Changes are persisted and immediately reflected in the system

4. **Delete workspace:**
   - Option to delete a workspace
   - Should prompt for confirmation (destructive operation)
   - Deletion cascades appropriately (deletes associated accounts, transactions, data)
   - Only admins can perform this action

**Acceptance criteria:**
- The `workspace_manager` role exists in the database and can be assigned to users
- Users with `workspace_manager` role see "Workspace Management" in their avatar menu (via F1-7)
- Create workspace form validates inputs (name required, email required, email format valid)
- Creating a workspace creates the workspace record, default account, and workspace_users owner entry in a single transaction
- The default account for a new workspace is correctly initialized with the same defaults as in F1-1
- View all workspaces displays all system workspaces with accurate metadata
- Edit and delete operations require the `workspace_manager` role (enforced on backend)
- Delete operation is reversible via database restore only (no soft-delete UI recovery)
- Workspace manager actions are logged (for future audit trail work)

**Dependencies:**
- F1-1 (auth and workspace creation logic — done)
- F1-7 (avatar menu, which includes the "Workspace Management" link — planned)
- Database schema: `users` and `workspaces` tables must support the `workspace_manager` role

**Notes:**
- Sending an email invitation to the default admin email is explicitly NOT part of this feature; that will be a separate future feature
- Workspace managers have no special access to the data within workspaces they create; they are purely administrative

---

### F1-9 Custom dropdown value management `[Future]`
**Status:** Future

A workspace-level configuration interface for managing custom enumerated values (dropdowns) across the system. This allows workspace owners to add, remove, replace, and set defaults for any configurable enum list (e.g., property models, transaction categories, account types, etc.), with constraints to ensure data integrity.

**Access & Permissions:**
- Accessible from the workspace settings page (F1-6) under a "Custom Values" or "Enums" section
- Restricted to users with the `owner` role in the workspace (enforced on backend)
- Workspace isolation: custom values are workspace-scoped; different workspaces have independent enum configurations

**Per-enum list capabilities:**

1. **View all values** — lists all values for the enum with metadata:
   - Value name / label
   - Default indicator (if set)
   - Count of records currently using this value
   - Status (active / archived, if applicable)

2. **Add a new value** — form to create a new enum value; value name is required and must be unique within that enum list for the workspace

3. **Set as default** — designate one value as the workspace default for this enum; only applies to *new* records created after the change (existing records retain their current value)

4. **Delete a value** — remove a value from the enum list; deletion is only allowed if no records currently use that value
   - If records exist using the value, show an atomic reassignment prompt:
     - Display count of affected records
     - Require user to select a replacement value from the remaining values
     - On confirmation, reassign all records to the replacement value in a single transaction, then delete the original value
     - If reassignment fails, abort the delete

5. **Mass-replace a value** — atomic operation to change all instances of one value to another:
   - User selects the source value (value to replace) and the target value (replacement)
   - Display confirmation with count of records affected
   - On confirmation, update all records using the source value to the target value in a single transaction
   - Cannot replace with a value that has already been deleted; can replace the default value, but designate a new default if necessary

**Enum scope:**
At feature definition time, the scope is deliberately open-ended: *any enum list in the system can potentially be made configurable*. As new enumerated fields are added (e.g., property models, transaction categories, account types), a decision is made per-field (at implementation time of that field's feature) whether it should support custom workspace values. Once decided, the field is wired into this custom enum management system.

**Initial enums (at launch of F1-9):**
The system will be built to support any enum; which enums are actually configurable by users will be determined as individual features (F2-1, F3-x, etc.) are specified and implemented.

**Acceptance criteria:**
- Workspace owners can view, add, delete, and replace custom enum values in the workspace
- Enum values are isolated per workspace
- Default value behavior affects only new records created after the change
- Deleting a value with linked records requires mandatory reassignment before deletion can proceed
- Mass-replace shows affected record count and is atomic (all-or-nothing)
- Both delete and mass-replace operations are logged (for audit purposes)
- Non-owner users cannot access the custom enum management UI (permission enforced on backend and frontend)
- Enum values cannot be deleted without reassignment if records exist
- Reassignment and mass-replace operations fail gracefully if any record update fails (transaction rollback)

**Dependencies:**
- F1-1 (auth — done)
- F1-6 (workspace settings page — must exist to host this UI)
- Individual enum-owning features (e.g., F2-1 for property models) must be built to support custom values for each field

**Notes:**
- This feature is built once and reused by all features that have configurable enums
- Each time a new enum is added to the system (e.g., a new transaction category enum), we decide whether it's workspace-configurable and wire it into this system
- The API must support querying the current enum values for any given list (e.g., `GET /api/workspace/enums/property-models`)
- Archived values (if applicable) should be hidden from dropdown UIs by default but remain queryable for reporting on historical records

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
