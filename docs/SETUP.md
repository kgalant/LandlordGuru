# LandlordGuru — Setup Guide

## What you are setting up

```
Browser (you or your wife, anywhere)
    ↕  HTTPS
Synology NAS  (serves index.html + key.php)
    ↕  Google Sheets API (HTTPS)
Google Sheet  (stores all data)
```

The app is one folder on your NAS. It reads and writes directly to a Google Sheet.
The private key never touches the browser — it is served on-demand by `key.php` from
outside the web root, so it cannot be downloaded directly.

---

## Step 1 — Create the Google Sheet

1. Go to https://sheets.google.com and create a new blank spreadsheet.
2. Name it something like **LandlordGuru**.
3. Copy the spreadsheet ID from the URL bar:
   `https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit`
4. Keep this tab open — you'll need the ID in Step 4.

The app will create all required tabs (properties, transactions, rules, fx_log, strings)
automatically the first time it loads. You don't need to create them manually.

---

## Step 2 — Create a Google Cloud Service Account

This gives the app permission to read/write the sheet without needing a browser login flow.

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one). Name it e.g. **landlord-guru**.
3. In the left menu go to **APIs & Services → Library**.
4. Search for **Google Sheets API** and click **Enable**.
5. Go to **APIs & Services → Credentials**.
6. Click **+ Create Credentials → Service account**.
7. Fill in a service account name (e.g. `landlord-guru`) → **Create and continue** → **Done**.
8. Click on the newly created service account in the list.
9. Go to the **Keys** tab → **Add Key → Create new key → JSON**.
10. A `.json` file will download. **Keep this file safe — it is a credential.**

The JSON file contains a `client_email` and a `private_key`. You'll use both below.

---

## Step 3 — Share the Google Sheet with the service account

1. Open your Google Sheet.
2. Click **Share** (top right).
3. Paste the `client_email` from the JSON file (looks like `landlord-guru@...iam.gserviceaccount.com`).
4. Set permission to **Editor**.
5. Click **Send**.

---

## Step 4 — Place the private key on the NAS (outside the web root)

The private key must **not** be inside the web-served folder. It lives one level up.

1. SSH into your NAS:
   ```bash
   ssh -p 1022 kim@nas.galant.info
   ```
2. Create a directory outside the web root:
   ```bash
   mkdir -p /volume1/homes/Kim/private
   ```
3. Create the key file:
   ```bash
   nano /volume1/homes/Kim/private/landlord-guru.pem
   ```
4. Paste the `private_key` value from the JSON file exactly as-is, including the
   `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines.
   Save and exit (`Ctrl+O`, `Ctrl+X`).
5. Set permissions so the web server user can read it:
   ```bash
   chmod o+x /volume1/homes/Kim
   chmod o+x /volume1/homes/Kim/private
   chmod o+r /volume1/homes/Kim/private/landlord-guru.pem
   ```

---

## Step 5 — Edit config.js

Copy `config.example.js` to `config.js` and fill in your values:

```javascript
const CONFIG = {
  SPREADSHEET_ID:        'paste-your-spreadsheet-id-here',
  SERVICE_ACCOUNT_EMAIL: 'paste-client_email-from-json-here',
  KEY_FETCHER_URL:       'key.php',   // do not change

  APP_NAME:      'LandlordGuru',
  BASE_CURRENCY: 'DKK',

  FX_RATES: {
    DKK: 1,
    PLN: 0.44,
    EUR: 7.46,
    USD: 6.89,
  },

  SHEETS: {
    PROPERTIES:   'properties',
    TRANSACTIONS: 'transactions',
    RULES:        'rules',
    FX_LOG:       'fx_log',
    STRINGS:      'strings',
  }
};
```

`config.js` contains your spreadsheet ID and service account email — not the private key.
Do not commit it to a public git repository.

---

## Step 6 — Deploy to Synology NAS

### Enable Web Station (if not already enabled)

1. Open **Package Center** on your Synology DSM.
2. Install **Web Station** if not installed.
3. Open Web Station → confirm the default HTTP service points to `/volume1/web`.

### Deploy using the publish script

From a Windows terminal in the project root:

```powershell
.\scripts\deploy.ps1
```

This copies everything in `frontend/` to the NAS **except** `config.js` (which is already
there and must not be overwritten). Files uploaded:

```
/volume1/web/landlordguru/
  index.html
  key.php
  debug.inc.php
  version.json
  config.js          ← already on NAS; never overwritten by deploy
  config.example.js
  css/
    style.css
  js/
    strings.js
    sheets.js
    data.js
    importer.js
    reports.js
    debug.js
```

### Test locally

On a computer on your home network, open:
`http://YOUR-NAS-LOCAL-IP/landlordguru/`

You can find your NAS IP in DSM → Control Panel → Network.

---

## Step 7 — Access from anywhere (Synology QuickConnect)

1. In DSM go to **Control Panel → QuickConnect**.
2. Enable QuickConnect and set an ID (e.g. `galant`).
3. Your app will then also be accessible at:
   `https://galant.quickconnect.to/landlordguru/`

---

## Step 8 — Optional: password-protect the app

Since the app has access to your financial data, restrict who can reach the folder.

**Option A — Synology reverse proxy + basic auth:**
1. DSM → Control Panel → Application Portal → Reverse Proxy.
2. Create a rule for the `/landlordguru/` path with password protection.

**Option B — `.htaccess` (if Apache is enabled in Web Station):**
Create `web/landlordguru/.htaccess`:
```
AuthType Basic
AuthName "LandlordGuru"
AuthUserFile /volume1/web/landlordguru/.htpasswd
Require valid-user
```
Then create `.htpasswd` using an htpasswd generator.

---

## Step 9 — Initial property setup

1. Open the app in your browser.
2. Go to **Properties** → **+ Add property** and add your units.
3. Go to **Rules** and add auto-categorisation rules for recurring transactions
   (e.g. tenant name → rent, insurance provider → insurance).

---

## Troubleshooting

**"Could not fetch key" or blank response from key.php**
- Verify the `.pem` file exists at the path configured in `key.php`.
- Check directory and file permissions (Step 4, step 5 — `o+x` on directories, `o+r` on file).
- Open `?debug` on the app URL — the Key File section will show whether the file exists and is readable.

**"key.php did not return a valid PEM key"**
- The file content doesn't start with `-----BEGIN PRIVATE KEY-----`.
- Re-paste the `private_key` value from the JSON file, making sure `\n` characters
  are actual newlines (most text editors handle this automatically).

**"Google auth failed"**
- Check that `SERVICE_ACCOUNT_EMAIL` in `config.js` matches `client_email` in the JSON.
- Check that the Google Sheets API is enabled in your Google Cloud project.

**"Sheets API error 403"**
- The service account doesn't have permission. Re-share the sheet (Step 3).

**"Sheets API error 404"**
- The `SPREADSHEET_ID` in `config.js` is wrong.

**"Unable to parse range: undefined"**
- A sheet name in `CONFIG.SHEETS` doesn't match an actual tab in the spreadsheet.
- Check that the tab names in the sheet match the values in `config.js`.

**App loads but shows no data after first setup**
- This is normal — the sheet is empty. Add a property first, then transactions.

**CSV import: columns mapped to wrong fields**
- Use the column mapping panel that appears after loading a file.
- Assign the correct role (Date / Description / Amount / Ignore) to each column.
- Set the correct date format and decimal separator for your bank.
- Save the mapping with a name so it auto-applies next time.

**CSV import: rows skipped with "Could not parse date" or "Could not parse amount"**
- The date format or decimal separator in the mapping panel doesn't match the file.
- Common formats: Jyske Bank uses `DD.MM.YYYY` and `,` decimal; mBank uses `YYYY-MM-DD` and `,` decimal.

**QuickConnect not working**
- QuickConnect routes through Synology's relay servers. If your DSM firewall blocks
  outbound traffic, allow traffic to `*.quickconnect.to`.
