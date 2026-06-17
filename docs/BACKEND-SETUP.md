# LandlordGuru v2 — Backend Setup Guide

This guide covers local development setup and server deployment for the v2 backend (Node.js + Express + PostgreSQL).

---

## Architecture overview

All databases live on `homedev`. Local machines connect via SSH tunnel.

| Environment | Location | Database | Port |
|-------------|----------|----------|------|
| Local dev | Your machine | `landlordguru_dev` | 3000 |
| Test | `homedev:~/dev/landlordguru-test` | `landlordguru_test` | 3001 |
| Production | `homedev:~/dev/landlordguru` | `landlordguru_prod` | 3002 |

---

## Local development setup

### Prerequisites

- **Node.js** 18+ and npm
- **Git** — with SSH key configured for `kim@homedev`
- **Mac**: built-in bash and ssh, nothing extra needed
- **Windows**: install [Git for Windows](https://git-scm.com/) — use Git Bash for all commands

No local PostgreSQL required — the database is on `homedev`, accessed via SSH tunnel.

---

### Step 1 — Clone repo and install dependencies

```bash
git clone <repo-url>
cd landlordguru
cd backend
npm install
```

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `backend/.env`. The key settings for local dev:

```
PORT=3000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://kim:PASSWORD@localhost:5433/landlordguru_dev
```

Note port **5433** — that's the local end of the SSH tunnel, not your local Postgres port.

Fill in `JWT_SECRET`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` with the real values.

---

### Step 3 — Windows Git Bash: configure SSH agent

Skip this on Mac (the SSH agent runs automatically).

On Windows, Git Bash doesn't load your SSH key automatically. Add these lines to `~/.bashrc`:

```bash
eval $(ssh-agent -s) > /dev/null
ssh-add ~/.ssh/id_ed25519 2>/dev/null
```

Restart Git Bash, or run `source ~/.bashrc`. Without this, the tunnel will fail or prompt for a password on every connection.

---

### Step 4 — First-run: create schema via tunnel

Run this once to create all tables in `landlordguru_dev`:

```bash
# Terminal 1 — open the tunnel
bash scripts/tunnel.sh

# Terminal 2 — run migrations
cd backend && npm run migrate
```

Verify by checking that the app starts and the login page loads (Step 5).

---

### Step 5 — Start local development

```bash
cd backend
npm run start:local
```

This opens the SSH tunnel and starts the server in a single command. Open `http://localhost:3000`.

For subsequent sessions you only need `npm run start:local` — no separate tunnel terminal.

**Standalone tunnel** (for running migrations without starting the server):
```bash
bash scripts/tunnel.sh
```

---

### Step 6 — Set up Google OAuth (for login)

### Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing). Name it `landlord-guru` or similar.
3. Enable the Google+ API:
   - Left menu → **APIs & Services → Library**
   - Search for **Google+ API** → click **Enable**

### Create an OAuth 2.0 credential

1. Left menu → **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. You may be prompted to configure the OAuth consent screen first:
   - Choose **External** (for personal use)
   - Fill in app name: `LandlordGuru`
   - Add yourself as a test user (your email)
   - Save and continue
4. Back to credentials: select **Web application** as the type
5. Add **authorized JavaScript origins**:
   - `http://localhost:3000` (local dev)
   - `http://homedev:3001` (test server)
6. Add **authorized redirect URIs**:
   - `http://localhost:3000/auth/google/callback` (local dev)
   - `http://homedev:3001/auth/google/callback` (test server)
   - `http://homedev:3002/auth/google/callback` (production)
7. Click **Create** — you'll see your Client ID and Client Secret
8. Copy both into your `.env` file:
   ```
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxx
   ```

> **Important**: `http://localhost:3000` must be in the authorized origins or local login will fail with a redirect URI mismatch error.

---

## Step 7 — Create additional workspaces and users (admin scripts)

The app auto-creates one workspace per user on first login. To share a workspace with another user:

```bash
# Add an existing user to your workspace
node backend/scripts/assign-user-to-workspace.js

# Prompts:
# - Enter user email (or auto-create if doesn't exist)
# - Enter workspace ID (or press Enter to list all)
# - Confirm role assignment (owner/editor/viewer)
```

Or create a workspace for someone else:

```bash
node backend/scripts/create-workspace.js

# Prompts:
# - Enter workspace name
# - Enter owner email (auto-created if doesn't exist)
```

---

## Step 8 — Test an API endpoint

```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","version":"..."}
```

Test any authenticated endpoint with a valid JWT token from a logged-in session:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/properties
```

---

## Step 9 — Logging configuration (Milestone 5.5+)

All backend operations are logged to stdout and to the `activity_log` database table.

### Default log level

By default, only errors are logged. To enable more verbose logging:

```bash
# In .env, set:
LOGGER_DEFAULT_LEVEL=info    # or debug for maximum verbosity
LOGGER_STDOUT_FORMAT=json    # structured JSON (or text for human-readable)
LOGGER_STORE_IN_DB=true      # write to activity_log table (recommended)
```

### Per-workspace or per-user log level

You can temporarily elevate logging for a specific workspace or user without changing the global setting:

```bash
psql landlordguru_dev

# For a workspace (temporary, expires tomorrow):
UPDATE workspaces
SET log_level = 'debug',
    log_level_expires_at = NOW() + INTERVAL '24 hours'
WHERE name = 'My Workspace';

# For a user (temporary, expires in 2 hours):
UPDATE workspace_users
SET log_level = 'debug',
    log_level_expires_at = NOW() + INTERVAL '2 hours'
WHERE workspace_id = '<id>' AND user_id = '<id>';

\q
```

When the expiry time passes, logging automatically reverts to the workspace (or global) default.

### Viewing logs

**In real-time (during development):**
```bash
npm start    # logs appear in the terminal
```

**From the database (production):**
```bash
psql landlordguru_prod
SELECT timestamp, level, action, parameters FROM activity_log
WHERE workspace_id = '<id>'
ORDER BY timestamp DESC
LIMIT 50;
```

**From PM2 (production):**
```bash
pm2 logs landlordguru
```

See `docs/LOGGING.md` for full reference on log levels, action naming conventions, and querying.

---

## Deployment

### Deploy to test server

From your local machine (Mac or Windows Git Bash):

```bash
./deploy-test.sh       # bash
.\deploy-test.ps1      # PowerShell
```

Pushes to origin, then SSHs into homedev, pulls, runs migrations, restarts PM2 (`landlordguru-test`, port 3001).

### Deploy to production

Production deploys are intentionally manual. SSH into homedev and run the script directly:

```bash
ssh kim@homedev
bash ~/dev/landlordguru/scripts/prod-deploy.sh
```

Pulls from origin, runs migrations, restarts PM2 (`landlordguru`, port 3002).

### First-time server setup on homedev

Only needed once when setting up the environments from scratch:

```bash
# Rename dev directory to test
pm2 delete landlordguru   # remove old process first to avoid ghost entries
mv ~/dev/landlordguru-dev ~/dev/landlordguru-test

# Create databases
createdb -U kim landlordguru_dev    # for local dev (via tunnel)
createdb -U kim landlordguru_prod   # for production

# Set up PM2 processes
PORT=3001 pm2 start ~/dev/landlordguru-test/backend/src/index.js --name landlordguru-test
PORT=3002 pm2 start ~/dev/landlordguru/backend/src/index.js --name landlordguru

# Persist and enable restart-on-boot
pm2 save
pm2 startup   # run the printed command to enable autostart
```

Create `.env` files manually on homedev (never committed to git):
- `~/dev/landlordguru-test/backend/.env` — `DATABASE_URL` → `landlordguru_test`, `PORT=3001`
- `~/dev/landlordguru/backend/.env` — `DATABASE_URL` → `landlordguru_prod`, `PORT=3002`

---

## Troubleshooting

### "Error: connect ECONNREFUSED 127.0.0.1:5432"
PostgreSQL is not running. Start it:
```bash
brew services start postgresql    # macOS
sudo service postgresql start     # Linux
```

### "Error: database landlordguru_dev does not exist"
Create it:
```bash
createdb landlordguru_dev
npm run migrate
```

### "Error: relation "workspaces" does not exist"
Migrations didn't run. Try:
```bash
npm run migrate
```

If it still fails, check that `DATABASE_URL` is correct in `.env`.

### "EACCES: permission denied, open '/path/to/backend/.env'"
The `.env` file has the wrong permissions. Fix with:
```bash
chmod 600 .env
```

### "Google OAuth redirect failed: Redirect URI mismatch"
Your `GOOGLE_CALLBACK_URL` in `.env` doesn't match the authorized redirect URI in Google Cloud Console. Update both to the same value and restart the server.

### "Token validation failed" or stuck on login page
- Check that `JWT_SECRET` is set and consistent
- Clear browser cookies and try logging in again
- Check server logs: `pm2 logs landlordguru`

### "Workspace isolation not working"
Every query should include `workspace_id` from the JWT. Verify:
```bash
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.decode('YOUR_TOKEN'))"
```

Should show `workspace_id` in the decoded payload.

---

## Next steps

See `docs/ARCHITECTURE.md` for the current milestone and what's coming next. For the data schema, see `docs/data-model.md`.
