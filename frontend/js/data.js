// ============================================================
//  DATA LAYER
//  Converts between flat sheet rows and JS objects.
//  Provides typed read/write for apartments and transactions.
// ============================================================

const DB = (() => {

  // ── Apartments ────────────────────────────────────────────

  const APT_COLS = ['id','name','address','country','currency','model','rent','aconto','tenant','lease_start','notes','active'];

  function rowToApt(row) {
    const o = {};
    APT_COLS.forEach((k, i) => o[k] = row[i] ?? '');
    o.rent   = parseFloat(o.rent)   || 0;
    o.aconto = parseFloat(o.aconto) || 0;
    o.active = o.active !== 'false' && o.active !== '0';
    return o;
  }

  function aptToRow(apt) {
    return APT_COLS.map(k => apt[k] ?? '');
  }

  async function getApartments() {
    const rows = await SheetsAPI.getRows(CONFIG.SHEETS.APARTMENTS);
    return rows.slice(1).map(rowToApt).filter(a => a.id);
  }

  async function saveApartment(apt) {
    if (!apt.id) apt.id = 'apt_' + Date.now();
    const rows = await SheetsAPI.getRows(CONFIG.SHEETS.APARTMENTS);
    const idx  = rows.slice(1).findIndex(r => r[0] === apt.id);
    if (idx >= 0) {
      await SheetsAPI.updateRow(CONFIG.SHEETS.APARTMENTS, idx + 2, aptToRow(apt));
    } else {
      await SheetsAPI.appendRows(CONFIG.SHEETS.APARTMENTS, [aptToRow(apt)]);
    }
    return apt;
  }

  // ── Transactions ──────────────────────────────────────────

  const TX_COLS = ['id','date','apartment_id','type','category','amount','currency',
                   'description','raw_description','source','import_batch','notes','reconciled','created_at'];

  function rowToTx(row) {
    const o = {};
    TX_COLS.forEach((k, i) => o[k] = row[i] ?? '');
    o.amount     = parseFloat(o.amount) || 0;
    o.reconciled = o.reconciled === 'true' || o.reconciled === '1';
    return o;
  }

  function txToRow(tx) {
    return TX_COLS.map(k => {
      if (k === 'reconciled') return tx[k] ? 'true' : 'false';
      return tx[k] ?? '';
    });
  }

  async function getTransactions() {
    const rows = await SheetsAPI.getRows(CONFIG.SHEETS.TRANSACTIONS);
    return rows.slice(1).map(rowToTx).filter(t => t.id);
  }

  // Save a single manually-entered transaction
  async function saveSingleTransaction(tx) {
    if (!tx.id)         tx.id         = 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    if (!tx.created_at) tx.created_at = new Date().toISOString();
    if (!tx.source)     tx.source     = 'manual';
    await SheetsAPI.appendRows(CONFIG.SHEETS.TRANSACTIONS, [txToRow(tx)]);
    return tx;
  }

  // Save a batch of imported transactions
  async function saveImportBatch(txList) {
    const batchId = 'import_' + Date.now();
    const now     = new Date().toISOString();
    const rows    = txList.map(tx => {
      tx.id           = 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      tx.import_batch = batchId;
      tx.created_at   = now;
      return txToRow(tx);
    });
    await SheetsAPI.appendRows(CONFIG.SHEETS.TRANSACTIONS, rows);
    return batchId;
  }

  // Update a single field on an existing transaction (e.g. category, notes)
  async function updateTransaction(txId, updates) {
    const rows = await SheetsAPI.getRows(CONFIG.SHEETS.TRANSACTIONS);
    const idx  = rows.slice(1).findIndex(r => r[0] === txId);
    if (idx < 0) throw new Error('Transaction not found: ' + txId);
    const existing = rowToTx(rows[idx + 1]);
    const updated  = { ...existing, ...updates };
    await SheetsAPI.updateRow(CONFIG.SHEETS.TRANSACTIONS, idx + 2, txToRow(updated));
    return updated;
  }

  // ── Rules ─────────────────────────────────────────────────

  const RULE_COLS = ['bank_profile','keyword','category','apartment_id'];

  function rowToRule(row) {
    const o = {};
    RULE_COLS.forEach((k, i) => o[k] = row[i] ?? '');
    return o;
  }

  async function getRules() {
    const rows = await SheetsAPI.getRows(CONFIG.SHEETS.RULES);
    return rows.slice(1).map(rowToRule).filter(r => r.keyword);
  }

  async function saveRules(rules) {
    const header = [RULE_COLS];
    const data   = rules.map(r => RULE_COLS.map(k => r[k] ?? ''));
    await SheetsAPI.overwriteSheet(CONFIG.SHEETS.RULES, [...header, ...data]);
  }

  // Apply rules to a description string, return { category, apartment_id } or null
  function applyRules(description, bankProfile, allRules) {
    const desc  = (description || '').toLowerCase();
    const rules = allRules.filter(r => !r.bank_profile || r.bank_profile === bankProfile || r.bank_profile === '');
    for (const rule of rules) {
      if (desc.includes(rule.keyword.toLowerCase())) {
        return { category: rule.category, apartment_id: rule.apartment_id || null };
      }
    }
    return null;
  }

  return {
    getApartments, saveApartment,
    getTransactions, saveSingleTransaction, saveImportBatch, updateTransaction,
    getRules, saveRules, applyRules,
  };
})();
