# LandlordGuru v2 — Backend Setup Guide

This guide covers setting up and deploying the v2 backend (Node.js + Express + PostgreSQL).

**Current status:** v2 is in active development. Auth is working (Milestone 3). API routes (properties, transactions, rules) are in progress.

---

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 12+ (local dev or remote connection string)
- **Git** (for cloning the repo)

### Optional tools (recommended)
- `psql` — PostgreSQL CLI for debugging
- `pm2` — process manager for production (install globally: `npm install -g pm2`)
- VS Code Remote SSH extension — for developing on a remote Linux server

---

## Step 1 — Clone repo and install dependencies

```bash
git clone https://github.com/your-username/LandlordGuru.git
cd LandlordGuru
cd backend
npm install
```

---

## Step 2 — Set up environment variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
# Server
PORT=3000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/landlordguru_dev

# Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-random-jwt-secret-here
SESSION_SECRET=your-random-session-secret-here

# Google OAuth (from Google Cloud Console, see Step 5)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**For local dev with PostgreSQL on the same machine:**
- If you have a default local PostgreSQL user/password, use `DATABASE_URL=postgresql://localhost/landlordguru_dev`
- Or set up a `.pgpass` file (see PostgreSQL docs) to avoid typing passwords every time

---

## Step 3 — Create PostgreSQL database

```bash
createdb landlordguru_dev
```

Or via `psql`:

```bash
psql -U postgres
# then in the postgres prompt:
CREATE DATABASE landlordguru_dev;
\q
```

---

## Step 4 — Run database migrations

From the `backend/` directory:

```bash
npm run migrate
```

This runs all migration files in `backend/src/db/migrations/` and creates:
- `workspaces` — workspace containers
- `users` — user accounts from Google OAuth
- `workspace_users` — role/permission assignments
- `properties`, `transactions`, `rules`, `fx_log`, `strings` — data tables

**Verify the migration succeeded:**

```bash
psql landlordguru_dev
\dt                    # list all tables
\d workspaces         # inspect the workspaces table schema
\q
```

---

## Step 5 — Set up Google OAuth (for login)

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
5. Add an authorized redirect URI:
   - For local dev: `http://localhost:3000/auth/google/callback`
   - For production: `https://landlordguru.galant.info/auth/google/callback`
6. Click **Create** — you'll see your Client ID and Client Secret
7. Copy both into your `.env` file:
   ```
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxx
   ```

---

## Step 6 — Start the development server

```bash
npm start
```

You should see:
```
Express listening on http://localhost:3000
Database connected
```

Open http://localhost:3000 in your browser. You should see:
- A login screen with "Sign in with Google" button
- Click it → you'll be redirected to Google → back to the app as a logged-in user

**Behind the scenes:**
- Your email is stored in the `users` table
- A `workspace` is auto-created for you
- A JWT token is issued and stored in an httpOnly cookie
- All subsequent API calls include the JWT automatically

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

The backend is middleware-ready but routes are in progress. Currently only `/api/health` is fully wired:

```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok"}
```

Once properties API is available (Milestone 4), test with:

```bash
# Requires a valid JWT token from login
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

## Production deployment

### On a Linux server (spare laptop or VPS)

1. **SSH into the server:**
   ```bash
   ssh kim@homedev
   ```

2. **Clone the repo and install:**
   ```bash
   cd ~/dev
   git clone https://github.com/your-username/LandlordGuru.git
   cd LandlordGuru/backend
   npm install --production
   ```

3. **Set up environment variables** on the server (create `.env`):
   ```
   PORT=3001
   FRONTEND_URL=https://landlordguru.galant.info
   DATABASE_URL=postgresql://user:pass@localhost/landlordguru_prod
   JWT_SECRET=...
   SESSION_SECRET=...
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=https://landlordguru.galant.info/auth/google/callback
   ```

4. **Create the production database:**
   ```bash
   createdb landlordguru_prod
   npm run migrate
   ```

5. **Start with PM2:**
   ```bash
   npm install -g pm2   # if not already installed
   pm2 start src/index.js --name landlordguru
   pm2 save
   ```

6. **Set up reverse proxy** (Nginx or Cloudflare Tunnel):
   - Point `landlordguru.galant.info` → `http://localhost:3001`
   - Enable HTTPS (Let's Encrypt or Cloudflare)

### Deployment workflow

After code changes:

```bash
# On your laptop
git push origin main

# On the server
cd ~/dev/LandlordGuru
git pull origin main
cd backend
npm install
npm run migrate        # (if there are new migrations)
pm2 reload landlordguru
```

Or use a GitHub webhook to auto-deploy on push.

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
