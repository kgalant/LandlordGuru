# Rental Portfolio — Setup Guide

## What you are setting up

```
Browser (you or your wife, anywhere)
    ↕  HTTPS
Synology NAS  (serves index.html)
    ↕  Google Sheets API (HTTPS)
Google Sheet  (stores all data)
```

The app is one folder on your NAS. It reads and writes directly to a Google Sheet.
No server-side code. No database to manage.

---

## Step 1 — Create the Google Sheet

1. Go to https://sheets.google.com and create a new blank spreadsheet.
2. Name it something like **Rental Portfolio**.
3. Copy the spreadsheet ID from the URL bar:
   `https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit`
4. Keep this tab open — you'll need the ID in Step 3.

The app will create all the required tabs (apartments, transactions, rules, fx_log)
automatically the first time it loads. You don't need to create them manually.

---

## Step 2 — Create a Google Cloud Service Account

This gives the app permission to read/write the sheet without needing a browser login flow.

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one). Name it e.g. **rental-portfolio**.
3. In the left menu go to **APIs & Services → Library**.
4. Search for **Google Sheets API** and click **Enable**.
5. Go to **APIs & Services → Credentials**.
6. Click **+ Create Credentials → Service account**.
7. Fill in:
   - Service account name: `rental-portfolio`
   - Click **Create and continue** → **Done**
8. Click on the newly created service account in the list.
9. Go to the **Keys** tab → **Add Key → Create new key → JSON**.
10. A `.json` file will download. **Keep this file safe — it is a credential.**

The JSON file looks like this:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "rental-portfolio@your-project.iam.gserviceaccount.com",
  ...
}
```

---

## Step 3 — Share the Google Sheet with the service account

1. Open your Google Sheet.
2. Click **Share** (top right).
3. Paste the `client_email` value from the JSON file (looks like `rental-portfolio@...iam.gserviceaccount.com`).
4. Set permission to **Editor**.
5. Click **Send** (ignore the "this is a service account" warning).

---

## Step 4 — Edit config.js

Open `config.js` in a text editor and fill in:

```javascript
SPREADSHEET_ID: 'paste-your-spreadsheet-id-here',

SERVICE_ACCOUNT: {
  client_email: 'paste-client_email-from-json-here',
  private_key:  'paste-private_key-from-json-here',
},
```

The `private_key` value is long and contains `\n` characters — paste it exactly as it
appears in the JSON file, including the `-----BEGIN PRIVATE KEY-----` header and footer.

**Security note:** `config.js` contains a credential. It lives on your NAS.
Do not commit it to a public git repository or share it.
The NAS should be the only device that serves these files.

---

## Step 5 — Deploy to Synology NAS

### Enable Web Station (if not already enabled)

1. Open **Package Center** on your Synology DSM.
2. Install **Web Station** if not installed.
3. Open Web Station → **Web Service Portal** → the default `http://` service
   should point to `/web` on your NAS's volume.

### Copy the app files

1. Open **File Station**.
2. Navigate to `web/` (this is the default web root).
3. Create a subfolder: `web/rental/`
4. Upload the entire `rental-portfolio` folder contents into `web/rental/`:
   ```
   web/rental/
     index.html
     config.js
     css/
       style.css
     js/
       sheets.js
       data.js
       importer.js
       reports.js
   ```

### Test locally

On a computer on your home network, open:
`http://YOUR-NAS-LOCAL-IP/rental/`

Example: `http://192.168.1.100/rental/`

You can find your NAS IP in DSM → Control Panel → Network.

---

## Step 6 — Access from anywhere (Synology QuickConnect)

1. In DSM go to **Control Panel → QuickConnect**.
2. Enable QuickConnect and set an ID (e.g. `galant-rentals`).
3. Your app will then also be accessible at:
   `https://galant-rentals.quickconnect.to/rental/`

This URL works from Singapore, Denmark, Poland — anywhere.

---

## Step 7 — Optional: password-protect the app

Since `config.js` contains credentials, you should restrict who can access the folder.

**Option A — Synology reverse proxy + basic auth:**
1. DSM → Control Panel → Application Portal → Reverse Proxy.
2. Create a rule for the `/rental/` path with password protection.

**Option B — `.htaccess` (if Apache is enabled in Web Station):**
Create `web/rental/.htaccess`:
```
AuthType Basic
AuthName "Rental Portfolio"
AuthUserFile /volume1/web/rental/.htpasswd
Require valid-user
```
Then create `.htpasswd` using an online htpasswd generator.

---

## Step 8 — Initial apartment setup

1. Open the app in your browser.
2. Go to **Apartments** → **+ Add apartment** and add your four units:
   - VB77 1tv (Denmark, DKK, long-term, tenant: Richard & Grenny Sabumba)
   - VB77 [second unit] (Denmark, DKK, long-term)
   - PL Apartment 1 (Poland, PLN, short-term)
   - PL Apartment 2 (Poland, PLN, short-term)
3. Go to **Rules** → **Load default rules** to seed the auto-categorisation.
   Then edit the apartment assignments to match your specific units.

---

## File structure reference

```
rental-portfolio/
├── index.html          Main app (all UI and app logic)
├── config.js           Your credentials and settings  ← EDIT THIS
├── css/
│   └── style.css       Stylesheet
└── js/
    ├── sheets.js       Google Sheets API (auth + CRUD)
    ├── data.js         Data layer (apartments, transactions, rules)
    ├── importer.js     CSV parser for bank statements
    └── reports.js      Filtering, aggregation, P&L
```

---

## Troubleshooting

**"Auth failed" on first load**
- Check that `client_email` and `private_key` in `config.js` are copied exactly from the JSON.
- Check that the Google Sheets API is enabled in your Google Cloud project.
- Check that the sheet is shared with the service account email as Editor.

**"Sheets API error 403"**
- The service account doesn't have permission. Re-share the sheet (Step 3).

**"Sheets API error 404"**
- The `SPREADSHEET_ID` in `config.js` is wrong.

**App loads but shows no data after first setup**
- This is normal — the sheet is empty. Add an apartment first, then transactions.

**CSV import: rows skipped**
- Check that you selected the correct bank profile.
- Jyske Bank exports use `;` as delimiter and `,` as decimal separator.
- mBank exports also use `;` delimiter.
- If your bank isn't listed, use "Generic CSV" and ensure columns are: date, description, amount.

**QuickConnect not working**
- QuickConnect routes through Synology's relay servers. If your DSM firewall blocks
  outbound traffic, allow traffic to `*.quickconnect.to`.
