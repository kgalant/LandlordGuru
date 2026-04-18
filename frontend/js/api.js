// ============================================================
//  API — REST client for the v2 backend
//  All calls include the JWT from window.AUTH_TOKEN.
//  Throws on non-2xx responses.
// ============================================================

const Api = (() => {

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
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  // ── Properties ────────────────────────────────────────────

  async function getProperties() {
    return request('GET', '/properties');
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
    if (filters.account_id) params.append('account_id', filters.account_id);
    if (filters.type) params.append('type', filters.type);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
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

  // ── Batch import ────────────────────────────────────────────
  // Creates multiple transactions with a shared import_batch ID

  async function createTransactionBatch(txList) {
    const batchId = 'import_' + Date.now();
    const created = [];
    for (const tx of txList) {
      const row = await createTransaction({ ...tx, import_batch: batchId });
      created.push(row);
    }
    return { batchId, created };
  }

  return {
    getProperties, createProperty, updateProperty, deleteProperty,
    getTransactions, createTransaction, updateTransaction, deleteTransaction,
    getRules, createRule, updateRule, deleteRule,
    createTransactionBatch,
  };
})();
