// ============================================================
//  GOOGLE SHEETS API LAYER
//  Handles JWT auth (service account) and sheet read/write.
//  No external dependencies — pure browser JS using WebCrypto.
// ============================================================

const SheetsAPI = (() => {

  let _tokenCache = null;

  // ── Helpers ───────────────────────────────────────────────

  function b64url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlBytes(bytes) {
    let bin = '';
    new Uint8Array(bytes).forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function pemToArrayBuffer(pem) {
    const b64 = pem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }

  async function importPrivateKey(pem) {
    return crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(pem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  // ── Auth ──────────────────────────────────────────────────

  async function getAccessToken() {
    if (_tokenCache && _tokenCache.expiry > Date.now()) return _tokenCache.token;

    const now = Math.floor(Date.now() / 1000);
    const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({
      iss:   CONFIG.SERVICE_ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud:   'https://oauth2.googleapis.com/token',
      iat:   now,
      exp:   now + 3600,
    }));

    const sigInput = `${header}.${payload}`;
    const key = await importPrivateKey(CONFIG.SERVICE_ACCOUNT.private_key);
    const sig = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(sigInput)
    );

    const jwt = `${sigInput}.${b64urlBytes(sig)}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    });

    if (!resp.ok) throw new Error('Google auth failed: ' + await resp.text());

    const data = await resp.json();
    _tokenCache = { token: data.access_token, expiry: Date.now() + 55 * 60 * 1000 };
    return data.access_token;
  }

  // ── Core request ──────────────────────────────────────────

  async function request(method, path, body) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}${path}`;
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    if (!resp.ok) throw new Error(`Sheets API error ${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

  // ── Public API ────────────────────────────────────────────

  // Read all rows from a named sheet. Returns array of row arrays.
  async function getRows(sheetName) {
    const data = await request('GET', `/values/${encodeURIComponent(sheetName)}`);
    return data.values || [];
  }

  // Append rows to a sheet. rows = array of arrays.
  async function appendRows(sheetName, rows) {
    return request('POST',
      `/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values: rows }
    );
  }

  // Overwrite a sheet entirely (used for config sheets like apartments, rules).
  async function overwriteSheet(sheetName, rows) {
    // Clear first
    await request('POST',
      `/values/${encodeURIComponent(sheetName)}:clear`,
      {}
    );
    if (rows.length === 0) return;
    return request('PUT',
      `/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`,
      { values: rows }
    );
  }

  // Update a single row by its 1-based row index.
  async function updateRow(sheetName, rowIndex, rowData) {
    const range = `${sheetName}!A${rowIndex}`;
    return request('PUT',
      `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { values: [rowData] }
    );
  }

  // Initialise sheets with headers if they don't exist yet.
  async function initSheets() {
    const metaResp = await request('GET', '');
    const existingNames = metaResp.sheets.map(s => s.properties.title);

    const required = [
      {
        name: CONFIG.SHEETS.APARTMENTS,
        headers: ['id','name','address','country','currency','model','rent','aconto','tenant','lease_start','notes','active']
      },
      {
        name: CONFIG.SHEETS.TRANSACTIONS,
        headers: ['id','date','apartment_id','type','category','amount','currency','description','raw_description','source','import_batch','notes','reconciled','created_at']
      },
      {
        name: CONFIG.SHEETS.RULES,
        headers: ['bank_profile','keyword','category','apartment_id']
      },
      {
        name: CONFIG.SHEETS.FX_LOG,
        headers: ['date','from_currency','to_currency','rate','source']
      },
    ];

    // Add any missing sheets
    const toAdd = required.filter(r => !existingNames.includes(r.name));
    if (toAdd.length > 0) {
      await request('POST', ':batchUpdate', {
        requests: toAdd.map(r => ({
          addSheet: { properties: { title: r.name } }
        }))
      });
    }

    // Write headers to any sheet that is empty
    for (const sheet of required) {
      const rows = await getRows(sheet.name);
      if (rows.length === 0) {
        await appendRows(sheet.name, [sheet.headers]);
      }
    }

    return true;
  }

  return { getRows, appendRows, overwriteSheet, updateRow, initSheets, getAccessToken };
})();
