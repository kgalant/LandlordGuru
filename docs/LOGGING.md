# Logging & Telemetry

## Overview

All backend operations are captured in structured logs. Logs are written to stdout and to
the `activity_log` database table. Log verbosity is configurable per workspace and per user,
with automatic expiry back to the global default.

Frontend telemetry (user actions) is collected in a queue and flushed to the backend when
the user triggers a server action. This is covered in Phase 3 (not yet implemented).

---

## Architecture

```
Route handler
  └── req.logger.info('property.created', { property_id, name })
        ├── Resolve effective log level
        │     1. workspace_users.log_level (if set and not expired)
        │     2. workspaces.log_level       (if set and not expired)
        │     3. Global default: 'error'
        ├── Write to stdout (JSON or text, per LOGGER_STDOUT_FORMAT)
        └── Insert into activity_log table (if LOGGER_STORE_IN_DB=true)
```

---

## Log Levels

Three levels, from least to most verbose:

| Level   | When to use |
|---------|-------------|
| `error` | Failures, exceptions, unexpected states |
| `info`  | Normal operations: create, update, delete, login |
| `debug` | Detailed tracing: query parameters, intermediate values |

The default level is `error`. Only errors are logged unless explicitly overridden.

---

## Configuration

### Environment variables (`backend/.env`)

```bash
LOGGER_DEFAULT_LEVEL=error      # Global default: error, info, or debug
LOGGER_STDOUT_FORMAT=json       # json (structured) or text (human-readable)
LOGGER_STORE_IN_DB=true         # Write to activity_log table as well as stdout
```

### Per-workspace log level

Set directly on the `workspaces` table:

```sql
UPDATE workspaces
SET log_level = 'info',
    log_level_expires_at = NOW() + INTERVAL '24 hours'
WHERE id = '<workspace-id>';
```

When `log_level_expires_at` passes, the workspace falls back to the global default automatically.
Set `log_level_expires_at = NULL` to make the override permanent (not recommended for production).

### Per-user log level

Set on the `workspace_users` table:

```sql
UPDATE workspace_users
SET log_level = 'debug',
    log_level_expires_at = NOW() + INTERVAL '2 hours'
WHERE workspace_id = '<workspace-id>'
  AND user_id = '<user-id>';
```

A user-level override takes precedence over the workspace level (if not expired).

### Resolution order

```
Is workspace_users.log_level set and log_level_expires_at > NOW()?
  → Yes: use it
  → No: Is workspaces.log_level set and log_level_expires_at > NOW()?
          → Yes: use it
          → No: use LOGGER_DEFAULT_LEVEL (default: 'error')
```

---

## Backend Logger Usage

The logger is available on every authenticated request as `req.logger`. It is injected by
the auth middleware and pre-configured with the current `workspace_id` and `user_id`.

### Methods

```javascript
req.logger.error(action, parameters)
req.logger.info(action, parameters)
req.logger.debug(action, parameters)
```

- `action` — dot-notation string describing what happened, e.g. `'property.create.success'`
- `parameters` — plain object with relevant IDs, values, and context

### Action naming convention

```
<resource>.<verb>              — for simple single-step operations
<resource>.<verb>.<outcome>    — for operations with distinct start/success/fail
```

Examples:
- `property.create.success`
- `property.create.failed`
- `transaction.import.started`
- `transaction.import.success`
- `auth.login.success`
- `auth.login.failed`

### Route handler pattern

```javascript
router.post('/api/properties', authenticate, async (req, res) => {
  const { name, country } = req.body;
  try {
    req.logger.info('property.create.started', { name, country });

    // ... create logic ...

    req.logger.info('property.create.success', {
      property_id: property.id,
      name,
      country
    });
    res.json(property);
  } catch (err) {
    req.logger.error('property.create.failed', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Activity Log Table

All log entries (at or above the effective level) are stored in `activity_log`.

| Field          | Type         | Description |
|----------------|--------------|-------------|
| `id`           | UUID         | Primary key |
| `workspace_id` | UUID         | FK → workspaces.id (CASCADE delete) |
| `user_id`      | UUID         | FK → users.id (SET NULL on delete) |
| `timestamp`    | timestamp    | When the event occurred |
| `level`        | varchar(10)  | `error`, `info`, or `debug` |
| `source`       | varchar(20)  | `backend` or `frontend` |
| `action`       | varchar(100) | Dot-notation event name |
| `description`  | text         | Optional human-readable summary |
| `parameters`   | jsonb        | Event-specific metadata |
| `created_at`   | timestamp    | Row insertion time |

**Indexes:** `(workspace_id, timestamp DESC)`, `(user_id, timestamp DESC)`, `(level)`

Logs are retained indefinitely. No automatic cleanup.

### Example queries

Recent activity for a workspace:
```sql
SELECT timestamp, level, action, parameters
FROM activity_log
WHERE workspace_id = '<id>'
ORDER BY timestamp DESC
LIMIT 100;
```

All errors in the last 24 hours:
```sql
SELECT timestamp, workspace_id, user_id, action, parameters
FROM activity_log
WHERE level = 'error'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

Actions by a specific user:
```sql
SELECT timestamp, action, parameters
FROM activity_log
WHERE workspace_id = '<workspace-id>'
  AND user_id = '<user-id>'
ORDER BY timestamp DESC;
```

---

## Frontend Telemetry (Phase 3 — not yet implemented)

When implemented, frontend user actions (button clicks, form submissions) will be collected
in a queue and sent to the backend attached to the next API request. The backend logs them
to `activity_log` with `source = 'frontend'`.

Configuration will be in `frontend/config.js`:
```javascript
const TELEMETRY_CONFIG = {
  ENABLED: true,
  FLUSH_INTERVAL_MS: 5 * 60 * 1000,  // flush every 5 minutes if no API call
};
```

---

## Troubleshooting

**Logs not appearing in activity_log**
- Check `LOGGER_STORE_IN_DB=true` in `.env`
- Check the effective log level — if it's `error` and you're logging `info`, it will be suppressed
- Verify the migration for `activity_log` has run: `SELECT COUNT(*) FROM activity_log;`

**Log level override not taking effect**
- Check `log_level_expires_at` has not already passed
- Query: `SELECT log_level, log_level_expires_at FROM workspaces WHERE id = '<id>';`

**Too many log entries**
- Raise the effective level to `error` (workspace or user setting)
- The table is indexed on `(workspace_id, timestamp DESC)` so queries stay fast even at volume

**Stdout logs not appearing**
- Check PM2 is capturing stdout: `pm2 logs landlordguru`
- For dev: logs go directly to terminal where `npm start` is running
