// ============================================================
//  API — REST client for the v2 backend
//  All calls include the JWT from window.AUTH_TOKEN.
//  Throws on non-2xx responses.
// ============================================================

export const Api = (() => {

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (window.AUTH_TOKEN) {
      opts.headers['Authorization'] = `Bearer ${window.AUTH_TOKEN}`;
    }
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch('/api' + path, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      if (!data.error && Array.isArray(data.errors)) err.rowErrors = data.errors;
      throw err;
    }
    return data;
  }

  // ── Properties ────────────────────────────────────────────

  async function getProperties({ includeArchived = false } = {}) {
    const qs = includeArchived ? '?include_archived=true' : '';
    return request('GET', `/properties${qs}`);
  }

  async function createProperty(data) {
    return request('POST', '/properties', data);
  }

  async function updateProperty(id, data) {
    return request('PATCH', `/properties/${id}`, data);
  }

  async function deleteProperty(id) {
    return request('DELETE', `/properties/${id}`);
  }

  // ── Transactions ────────────────────────────────────────────

  async function getTransactions(filters = {}) {
    let path = '/transactions';
    const params = new URLSearchParams();
    if (filters.account_id)  params.append('account_id',  filters.account_id);
    if (filters.property_id) params.append('property_id', filters.property_id);
    if (filters.type)        params.append('type',        filters.type);
    if (filters.category)    params.append('category',    filters.category);
    if (filters.from)        params.append('from',        filters.from);
    if (filters.to)          params.append('to',          filters.to);
    if (filters.search)      params.append('search',      filters.search);
    if (filters.page)        params.append('page',        filters.page);
    if (filters.limit)       params.append('limit',       filters.limit);
    if (filters.sort_col)    params.append('sort_col',    filters.sort_col);
    if (filters.sort_dir)    params.append('sort_dir',    filters.sort_dir);
    if (filters.import_batch)     params.append('import_batch',     filters.import_batch);
    if (filters.reconciled)       params.append('reconciled',       filters.reconciled);
    if (filters.exclude_children) params.append('exclude_children', filters.exclude_children);
    if (params.toString()) path += '?' + params.toString();
    return request('GET', path);
  }

  async function createTransaction(data) {
    return request('POST', '/transactions', data);
  }

  async function updateTransaction(id, data) {
    return request('PATCH', `/transactions/${id}`, data);
  }

  async function deleteTransaction(id) {
    return request('DELETE', `/transactions/${id}`);
  }

  async function getSplits(id) {
    return request('GET', `/transactions/${id}/splits`);
  }

  async function saveSplits(id, rows) {
    return request('PUT', `/transactions/${id}/splits`, rows);
  }

  async function removeSplits(id) {
    return request('DELETE', `/transactions/${id}/splits`);
  }

  // ── Rules ────────────────────────────────────────────

  async function getRules(filters = {}) {
    let path = '/rules';
    const params = new URLSearchParams();
    if (filters.bank_profile) params.append('bank_profile', filters.bank_profile);
    if (params.toString()) path += '?' + params.toString();
    return request('GET', path);
  }

  async function createRule(data) {
    return request('POST', '/rules', data);
  }

  async function updateRule(id, data) {
    return request('PATCH', `/rules/${id}`, data);
  }

  async function deleteRule(id) {
    return request('DELETE', `/rules/${id}`);
  }

  // ── Workspace Settings ────────────────────────────────────

  async function getWorkspaceSettings() {
    return request('GET', '/workspace/settings');
  }

  async function updateWorkspaceSettings(data) {
    return request('PATCH', '/workspace/settings', data);
  }

  // ── Transaction Categories ───────────────────────────────────

  async function getTransactionCategories() {
    return request('GET', '/workspace/enums/transaction-categories');
  }

  async function createTransactionCategory(data) {
    return request('POST', '/workspace/enums/transaction-categories', data);
  }

  async function updateTransactionCategory(id, data) {
    return request('PATCH', `/workspace/enums/transaction-categories/${id}`, data);
  }

  async function deleteTransactionCategory(id) {
    return request('DELETE', `/workspace/enums/transaction-categories/${id}`);
  }

  async function getTransactionCategoriesAll() {
    return request('GET', '/workspace/enums/transaction-categories?include_inactive=true');
  }

  // ── Currency Rates ───────────────────────────────────────────

  async function getCurrencyRates() {
    return request('GET', '/currency-rates');
  }

  async function createCurrencyRate(data) {
    return request('POST', '/currency-rates', data);
  }

  async function deleteCurrencyRate(id) {
    return request('DELETE', `/currency-rates/${id}`);
  }

  // ── Description mappings ───────────────────────────────────

  async function getDescMappings() {
    return request('GET', '/description-mappings');
  }

  async function saveDescMapping(data) {
    return request('POST', '/description-mappings', data);
  }

  async function deleteDescMapping(id) {
    return request('DELETE', `/description-mappings/${id}`);
  }

  // ── Accounts ────────────────────────────────────────────────

  async function getAccounts({ status = 'active' } = {}) {
    return request('GET', `/accounts?status=${status}`);
  }

  async function getAccount(id) {
    return request('GET', `/accounts/${id}`);
  }

  async function createAccount(data) {
    return request('POST', '/accounts', data);
  }

  async function updateAccount(id, data) {
    return request('PATCH', `/accounts/${id}`, data);
  }

  async function deleteAccount(id, reassign_to) {
    return request('DELETE', `/accounts/${id}`, { reassign_to });
  }

  async function setDefaultAccount(id) {
    return request('POST', `/accounts/${id}/set-default`);
  }

  async function getAccountItems(id) {
    return request('GET', `/accounts/${id}/items`);
  }

  // ── Split rules ─────────────────────────────────────────────

  async function getSplitRules() {
    return request('GET', '/split-rules');
  }

  async function createSplitRule(rule) {
    return request('POST', '/split-rules', rule);
  }

  async function updateSplitRule(id, patch) {
    return request('PATCH', `/split-rules/${id}`, patch);
  }

  async function deleteSplitRule(id) {
    return request('DELETE', `/split-rules/${id}`);
  }

  // ── Reports ────────────────────────────────────────────────

  async function getPnlReport({ from, to, property_id, account_id, account_scope } = {}) {
    const qs = new URLSearchParams();
    if (from)          qs.set('from', from);
    if (to)            qs.set('to', to);
    if (property_id)   qs.set('property_id', property_id);
    if (account_id)    qs.set('account_id', account_id);
    if (account_scope) qs.set('account_scope', account_scope);
    const q = qs.toString();
    return request('GET', `/reports/pnl${q ? '?' + q : ''}`);
  }

  // ── Batch import ────────────────────────────────────────────

  async function importTransactions(txList) {
    return request('POST', '/transactions/import', txList);
  }

  async function checkImportDuplicates(rows) {
    return request('POST', '/transactions/import/check', rows);
  }

  async function getImportHistory() {
    return request('GET', '/transactions/import/history');
  }

  async function deleteImportBatch(batchId) {
    return request('DELETE', `/transactions/import/${encodeURIComponent(batchId)}`);
  }

  return {
    getProperties, createProperty, updateProperty, deleteProperty,
    getTransactions, createTransaction, updateTransaction, deleteTransaction,
    getSplits, saveSplits, removeSplits,
    getRules, createRule, updateRule, deleteRule,
    getWorkspaceSettings, updateWorkspaceSettings,
    getTransactionCategories, getTransactionCategoriesAll,
    createTransactionCategory, updateTransactionCategory, deleteTransactionCategory,
    getAccounts, getAccount, createAccount, updateAccount, deleteAccount, setDefaultAccount, getAccountItems,
    getCurrencyRates, createCurrencyRate, deleteCurrencyRate,
    getDescMappings, saveDescMapping, deleteDescMapping,
    importTransactions, getImportHistory, deleteImportBatch, checkImportDuplicates,
    getSplitRules, createSplitRule, updateSplitRule, deleteSplitRule,
    getPnlReport,
  };
})();
