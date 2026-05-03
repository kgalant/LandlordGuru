// ============================================================
//  APP — main UI controller
// ============================================================

import { CONFIG, CATEGORIES, BANK_PROFILES } from '../config.js';
import { t } from './strings.js';
import { Api } from './api.js';
import { Importer } from './importer.js';
import { Reports } from './reports.js';
import { decodeToken } from './auth.js';

// ── Global state ──────────────────────────────────────────

let showArchivedProperties = false;

let State = {
  properties:           [],
  transactions:         [],
  rules:                [],
  descMappings:         [],
  transactionCategories: {},
  editingTxId:          null,
  editingAptId:         null,
  importRows:           [],
};

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr).slice(0, 10);
  const fmt = State.workspaceSettings?.date_format || 'YYYY-MM-DD';
  const [y, m, d] = s.split('-');
  if (fmt === 'MM-DD-YYYY') return `${m}-${d}-${y}`;
  if (fmt === 'DD-MM-YYYY') return `${d}-${m}-${y}`;
  return s;
}

function parseDateToISO(str) {
  if (!str || str.length !== 10) return '';
  const fmt = State.workspaceSettings?.date_format || 'YYYY-MM-DD';
  const parts = str.split('-');
  if (parts.length !== 3) return '';
  if (fmt === 'MM-DD-YYYY') return `${parts[2]}-${parts[0]}-${parts[1]}`;
  if (fmt === 'DD-MM-YYYY') return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return str;
}

// Auto-inserts date separators as the user types in a reports date input
function onDateFilterInput(input) {
  const fmt = State.workspaceSettings?.date_format || 'YYYY-MM-DD';
  const val = input.value;
  for (let i = 0; i < fmt.length; i++) {
    if (!/[A-Z0-9]/i.test(fmt[i]) && i === val.length) {
      input.value = val + fmt[i];
      break;
    }
  }
}

function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr);
  const datePart = s.slice(0, 10);
  const time = s.slice(11, 16);
  return time ? `${fmtDate(datePart)} ${time}` : fmtDate(datePart);
}

function _buildMatchTag(row) {
  if (row._isDuplicate && row._duplicateMatch) {
    const m = row._duplicateMatch;
    const importedOn = m.created_at
      ? fmtDateTime(m.created_at).slice(0, 10)
      : '?';
    return `<span class="dup-badge"><span class="tag tag-dup">Duplicate</span><div class="dup-badge-tip">${escHtml(fmtDate(m.date))} &bull; ${escHtml(m.description || '—')} &bull; ${parseFloat(m.amount).toLocaleString()}<br>Imported on ${escHtml(importedOn)}</div></span> `;
  }
  if (row._descMappingMatched) return '<span class="tag tag-mapping">mapped</span> ';
  if (row._autoMatched)        return '<span class="tag tag-auto">auto</span> ';
  return '';
}

// Returns flat array of all category objects from the grouped State
function flatCats() {
  return Object.values(State.transactionCategories).flat();
}

// Resolves a category label using API data first, then i18n fallback
function catLabel(key) {
  return Reports.categoryLabel(key, flatCats());
}

// ── Boot ──────────────────────────────────────────────────

async function boot() {
  if (!window.AUTH_TOKEN) { setLoading(false); return; }
  setLoading(true, t('status.connecting'));
  try {
    // v2 mode: authenticated via JWT — use backend API
    await refreshAll();
  } catch(e) {
    setStatus(t('status.error', { message: e.message }));
    toast(t('status.connFailed', { error: e.message }), 'error');
    console.error(e);
  }
  setLoading(false);
}

async function refreshAll() {
  setLoading(true, t('status.loadingData'));
  try {
    // v2 mode: data from backend API
    const [props, txs, rules, descMappings, wsSettings, rates, txCategories] = await Promise.all([
      Api.getProperties(),
      Api.getTransactions({ limit: 10000 }),
      Api.getRules(),
      Api.getDescMappings(),
      Api.getWorkspaceSettings(),
      Api.getCurrencyRates(),
      Api.getTransactionCategories(),
    ]);
    State.properties             = props;
    State.transactions           = (txs.data ?? txs).map(tx => ({ ...tx, amount: parseFloat(tx.amount) }));
    State.rules                  = rules;
    State.descMappings           = descMappings;
    State.workspaceSettings      = wsSettings;
    State.currencyRates          = rates;
    State.transactionCategories  = txCategories;
    window.LAST_SYNC = new Date();
    populateAllDropdowns();
    renderCurrentPage();
    setStatus(t('status.synced', { time: window.LAST_SYNC.toLocaleTimeString() }));
  } catch(e) {
    setStatus(t('status.syncError'));
    toast(t('status.connFailed', { error: e.message }), 'error');
    console.error(e);
  }
  setLoading(false);
}

// ── Page routing ──────────────────────────────────────────

let currentPage = 'dashboard';

function showPage(id, btn) {
  currentPage = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  renderCurrentPage();
}

function renderCurrentPage() {
  if (currentPage === 'dashboard')    renderDashboard();
  if (currentPage === 'transactions') { if (!txTable) initTxTable(); else txTable.refresh(); }
  if (currentPage === 'reports')      renderReports();
  if (currentPage === 'properties')   renderPropertyList();
  if (currentPage === 'rules')        { if (!rulesTable) initRulesTable(); else rulesTable.refresh(); }
  if (currentPage === 'settings')     renderSettings();
  if (currentPage === 'import')       { loadImportHistory(); _updatePreviewBtnState(); }
}

// ── Populate dropdowns ────────────────────────────────────

function populateAllDropdowns() {
  const propOpts = State.properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const repYear = document.getElementById('rep-year');
  if (repYear) {
    const years = [...new Set(State.transactions.map(tx => tx.date?.slice(0,4)).filter(Boolean))].sort().reverse();
    const cur = repYear.value;
    repYear.innerHTML = '<option value="">— Year —</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    if (cur && years.includes(cur)) repYear.value = cur;
  }

  const repApt = document.getElementById('rep-apt');
  if (repApt) { const v = repApt.value; repApt.innerHTML = `<option value="all">${t('tx.filter.allProperties')}</option>${propOpts}`; repApt.value = v || 'all'; }

  ['tx-m-apt','import-apt','rule-m-apt'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    let blank;
    if (id === 'rule-m-apt')  blank = `<option value="">${t('rules.modal.anyProperty')}</option>`;
    else if (id === 'import-apt') blank = `<option value="">${t('import.autoDetect')}</option>`;
    else                      blank = `<option value="">${t('common.select')}</option>`;
    el.innerHTML = blank + propOpts;
  });

  const catOpts = Importer.buildCategoryOptions('');
  ['tx-m-cat','rule-m-cat'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${t('common.select')}</option>` + catOpts;
  });
}

// ── Dashboard ─────────────────────────────────────────────

let dashRecentTable = null;

function initDashRecentTable() {
  dashRecentTable = DataTable.create({
    containerId: 'dash-recent-table-wrap',
    title: t('dashboard.recentTx'),
    actions: [
      { label: t('dashboard.viewAll'), onclick: "showPage('transactions', document.querySelector('nav button:nth-child(2)'))" },
    ],
    columns: [
      { key: 'date',        label: t('tx.col.date'),        sortable: false },
      { key: 'property',    label: t('tx.col.property'),    sortable: false },
      { key: 'description', label: t('tx.col.description'), sortable: false },
      { key: 'category',    label: t('tx.col.category'),    sortable: false },
      { key: 'amount',      label: t('tx.col.amount'),      sortable: false, align: 'right' },
    ],
    fetchData: async () => {
      const recent = [...State.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      return { data: recent, total: recent.length };
    },
    renderRow: (tx) => dashTxRow(tx),
  });
}

function renderDashboard() {
  const txs  = State.transactions;
  const props = State.properties;
  const yr   = new Date().getFullYear();
  const ytd  = txs
    .filter(tx => tx.date.startsWith(yr) && tx.type === 'income')
    .reduce((s, tx) => s + tx.amount * (CONFIG.FX_RATES[tx.currency] || 1), 0);

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric">
      <div class="m-label">${t('dashboard.metrics.activeProperties')}</div>
      <div class="m-value">${props.filter(p => p.active).length}</div>
      <div class="m-sub">${props.filter(p => p.country==='DK').length} DK · ${props.filter(p => p.country==='PL').length} PL</div>
    </div>
    <div class="metric">
      <div class="m-label">${t('dashboard.metrics.ytdIncome')}</div>
      <div class="m-value">${Reports.fmtDKK(ytd)}</div>
      <div class="m-sub">${t('dashboard.metrics.ytdSub', { month: new Date().toLocaleString('en',{month:'short'}), year: yr })}</div>
    </div>
    <div class="metric">
      <div class="m-label">${t('dashboard.metrics.totalTx')}</div>
      <div class="m-value">${txs.length}</div>
      <div class="m-sub">${t('dashboard.metrics.txSub', { manual: txs.filter(tx=>tx.source==='manual').length, imported: txs.filter(tx=>tx.source!=='manual').length })}</div>
    </div>
    <div class="metric">
      <div class="m-label">${t('dashboard.metrics.unreconciled')}</div>
      <div class="m-value">${txs.filter(tx=>!tx.reconciled).length}</div>
      <div class="m-sub">${t('dashboard.metrics.unreconciledSub')}</div>
    </div>
  `;

  document.getElementById('dash-apt-cards').innerHTML = props.length === 0
    ? `<div class="empty-state-cta" style="text-align:center;padding:2rem;grid-column:1/-1">
        <h3 style="margin:0 0 0.5rem 0">${t('property.noProperties')}</h3>
        <p style="margin:0 0 1.5rem 0;color:#666">${t('property.noPropertiesSub')}</p>
        <button class="btn btn-primary" onclick="openPropertyModal()">${t('property.addBtn')}</button>
      </div>`
    : props.map(p => {
        const ptxs    = txs.filter(tx => tx.property_id === p.id);
        const income  = ptxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
        const rent    = parseFloat(p.rent) || 0;
        const aconto  = parseFloat(p.aconto) || 0;
        const monthly = rent + aconto;
        const addr    = p.address || '<span style="color:#999;font-style:italic">no address registered</span>';
        return `<div class="apt-card">
          <span class="badge badge-${p.country.toLowerCase()}">${t('country.' + p.country)} · ${p.currency}</span>
          <span class="badge badge-model" style="margin-left:6px">${t('property.model.' + (p.model || 'longterm'))}</span>
          <div class="apt-name">${p.name}</div>
          <div class="apt-addr">${addr}</div>
          <div class="apt-stats">
            <div class="stat"><strong>${monthly > 0 ? Reports.fmt(monthly, p.currency) : '—'}</strong>${t('common.monthly')}</div>
            <div class="stat"><strong>${income  ? Reports.fmt(income,  p.currency) : '—'}</strong>${t('common.totalIncome')}</div>
            <div class="stat"><strong>${p.tenant || '—'}</strong>${t('property.metric.tenant')}</div>
          </div>
        </div>`;
      }).join('');

  if (!dashRecentTable) initDashRecentTable(); else dashRecentTable.refresh();
}

// ── Transactions table ────────────────────────────────────

let txTable = null;

// Keep --nav-h CSS var in sync so #tx-table-wrap height calc stays correct.
function updateTxStickyOffsets() {
  const nav = document.querySelector('header');
  if (!nav) return;
  document.documentElement.style.setProperty('--nav-h', nav.getBoundingClientRect().height + 'px');
}

const _txStickyObserver = new ResizeObserver(updateTxStickyOffsets);
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('header');
  if (nav) _txStickyObserver.observe(nav);
  updateTxStickyOffsets();
});

function initTxTable() {
  txTable = DataTable.create({
    containerId: 'tx-table-wrap',
    title: t('tx.title'),
    actions: [
      { label: t('tx.addBtn'), onclick: 'openTxModal()' },
    ],
    columns: [
      {
        key: 'property', label: t('tx.col.property'), sortable: true,defaultVisible: true,
        filter: {
          type: 'select',
          placeholder: t('tx.filter.allProperties'),
          options: () => State.properties.map(p => ({ value: String(p.id), label: p.name })),
        },
      },
      {
        key: 'date', label: t('tx.col.date'), sortable: true, defaultVisible: true,
        filter: { type: 'date-range', placeholder: State.workspaceSettings?.date_format || 'YYYY-MM-DD' },
      },
      {
        key: 'year', filterOnly: true,
        filter: {
          type: 'select',
          placeholder: t('tx.filter.allYears'),
          setsDateRange: 'date',
          options: () => {
            const years = [...new Set(State.transactions.map(tx => tx.date.slice(0, 4)))].sort().reverse();
            return years.map(y => ({ value: y, label: y }));
          },
        },
      },
      {
        key: 'type', label: t('tx.col.type'), sortable: true,defaultVisible: true,
        filter: {
          type: 'select',
          placeholder: t('tx.filter.allTypes'),
          options: [
            { value: 'income',   label: t('categories.income') },
            { value: 'expense',  label: t('categories.expense') },
            { value: 'deposit',  label: t('categories.deposit') },
            { value: 'transfer', label: t('categories.transfer') },
          ],
        },
      },
      {
        key: 'category', label: t('tx.col.category'), sortable: true,defaultVisible: true,
        filter: {
          type: 'select',
          placeholder: t('tx.filter.allCats'),
          options: (filterState) => {
            const type = filterState.type || '';
            if (type && CATEGORIES[type]) {
              return Object.keys(CATEGORIES[type].items).map(k => ({ value: k, label: t('categories.items.' + k) }));
            }
            return Object.entries(CATEGORIES).flatMap(([, group]) =>
              Object.keys(group.items).map(k => ({ value: k, label: t('categories.items.' + k) }))
            );
          },
        },
      },
      {
        key: 'description', label: t('tx.col.description'), sortable: true,defaultVisible: true,
        filter: { type: 'text', placeholder: t('common.search') },
      },
      { key: 'source',   label: t('tx.col.source'), sortable: true,  defaultVisible: true },
      { key: 'amount',   label: t('tx.col.amount'), sortable: true,  defaultVisible: true, align: 'right' },
      {
        key: 'reconciled', label: t('tx.col.reconciled'), sortable: false, defaultVisible: true,
        filter: { type: 'toggle', placeholder: t('tx.filter.unreconciled') },
        width: '6rem',
      },
      { key: '_actions', label: '',                 sortable: false, defaultVisible: true, width: '5rem' },
    ],
    fetchData: async (params) => {
      const filters = { page: params.page, limit: params.limit };
      if (params.sort_col) { filters.sort_col = params.sort_col; filters.sort_dir = params.sort_dir; }
      if (params.property)    filters.property_id = params.property;
      if (params.type)        filters.type        = params.type;
      if (params.category)    filters.category    = params.category;
      const dateFrom = parseDateToISO(params['date-from'] || '');
      const dateTo   = parseDateToISO(params['date-to']   || '');
      if (dateFrom) filters.from = dateFrom;
      if (dateTo)   filters.to   = dateTo;
      if (params.description)  filters.search      = params.description;
      if (params.reconciled)   filters.reconciled  = 'false';
      const result = await Api.getTransactions(filters);
      return {
        data:  (result.data ?? []).map(tx => ({ ...tx, amount: parseFloat(tx.amount) })),
        total: result.total ?? 0,
      };
    },
    renderRow: (tx) => txRow(tx),
    pagination: {
      enabled: true,
      defaultLimit: 50,
      limitOptions: [10, 20, 50, 100],
    },
    bulkActions: [
      { label: t('tx.bulkDelete'), onclick: (ids) => bulkDeleteSelectedTx(ids) },
    ],
    columnVisibility: {
      enabled: true,
      storageKey: 'datatable-tx-columns',
    },
  });
}

function dashTxRow(tx) {
  const prop   = State.properties.find(p => p.id === tx.property_id);
  const catLbl = catLabel(tx.category);
  const amtCls = tx.type === 'income' ? 'positive' : tx.type === 'expense' ? 'negative' : '';
  const currency = tx.currency || prop?.currency || '';
  return `<tr class="clickable-row" onclick="openTxModal('${tx.id}')">
    <td>${fmtDate(tx.date)}</td>
    <td>${prop ? prop.name : '<span class="muted">—</span>'}</td>
    <td>${tx.description}</td>
    <td><span class="tag tag-${tx.type}">${catLbl}</span></td>
    <td class="amount-cell ${amtCls}">${Reports.fmt(tx.amount, currency)}<span class="muted" style="font-size:11px;margin-left:4px">${currency}</span></td>
  </tr>`;
}

function txRow(tx) {
  const prop   = State.properties.find(p => p.id === tx.property_id);
  const catLbl = catLabel(tx.category);
  const srcLbl = tx.source === 'manual' ? t('common.manual') : (BANK_PROFILES[tx.source]?.label || tx.source);
  const amtCls = tx.type === 'income' ? 'positive' : tx.type === 'expense' ? 'negative' : '';
  const currency = tx.currency || prop?.currency || '';

  const reportingCurrency = State.workspaceSettings?.reporting_currency;
  let convertedHtml = '';
  if (reportingCurrency && currency !== reportingCurrency) {
    const rates = State.currencyRates || [];
    const rate = rates
      .filter(r => r.from_currency === currency && r.to_currency === reportingCurrency && r.effective_date <= tx.date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
    if (rate) {
      const converted = (tx.amount * parseFloat(rate.rate)).toFixed(2);
      convertedHtml = `<div style="font-size:11px;color:var(--text3)">${Reports.fmt(converted, reportingCurrency)}</div>`;
    }
  }

  const recBtn = `<button class="btn-reconcile${tx.reconciled ? ' is-reconciled' : ''}" title="${tx.reconciled ? 'Mark unreconciled' : 'Mark reconciled'}" onclick="event.stopPropagation();toggleReconciled('${tx.id}',${!!tx.reconciled})">${tx.reconciled ? t('tx.reconcileBtn') : t('tx.unreconcileBtn')}</button>`;
  const deleteBtn = window.AUTH_TOKEN
    ? `<button class="btn btn-sm btn-secondary" style="margin-left:6px" onclick="event.stopPropagation();deleteTxWithConfirm('${tx.id}')">${t('common.delete')}</button>`
    : '';
  const recClass = tx.reconciled ? ' tx-reconciled' : '';
  return `<tr class="clickable-row${recClass}" onclick="openTxModal('${tx.id}')">
    <td onclick="event.stopPropagation()"><input type="checkbox" data-row-id="${tx.id}"></td>
    <td data-col="property">${prop ? prop.name : '<span class="muted">—</span>'}</td>
    <td data-col="date">${fmtDate(tx.date)}</td>
    <td data-col="type"><span class="tag tag-${tx.type}">${t('categories.' + tx.type)}</span></td>
    <td data-col="category"><span class="tag tag-${tx.type}">${catLbl}</span></td>
    <td data-col="description">${tx.description}${tx.notes ? `<div style="font-size:11px;color:var(--text3)">${tx.notes}</div>` : ''}</td>
    <td data-col="source"><span class="muted" style="font-size:11px">${srcLbl}</span></td>
    <td data-col="amount" class="amount-cell ${amtCls}">${Reports.fmt(tx.amount, currency)}<span class="muted" style="font-size:11px;margin-left:4px">${currency}</span>${convertedHtml}</td>
    <td data-col="reconciled" style="text-align:center">${recBtn}</td>
    <td><div style="display:flex">${deleteBtn}</div></td>
  </tr>`;
}

async function toggleReconciled(txId, current) {
  try {
    await Api.updateTransaction(txId, { reconciled: !current });
    txTable?.refresh();
  } catch(e) {
    toast(t('tx.toast.saveFailed', { error: e.message }), 'error');
  }
}

async function bulkDeleteSelectedTx(ids) {
  if (!ids.length) { toast(t('tx.toast.noneSelected'), 'error'); return; }
  if (!confirm(t('tx.confirmBulkDelete', { count: ids.length }))) return;
  setLoading(true, t('status.deleting'));
  try {
    await Promise.all(ids.map(id => Api.deleteTransaction(id)));
    await refreshAll();
    toast(t('tx.toast.bulkDeleted', { count: ids.length }), 'success');
  } catch(e) {
    toast(t('tx.toast.delFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

// ── Transaction modal ─────────────────────────────────────

function openTxModal(txId) {
  State.editingTxId = txId || null;
  const modal  = document.getElementById('modal-tx');
  const delBtn = document.getElementById('tx-m-delete-btn');
  populateAllDropdowns();

  const _hint = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent  = text || '';
    el.style.display = text ? 'block' : 'none';
  };

  if (txId) {
    const tx = State.transactions.find(tx => tx.id === txId);
    if (!tx) return;
    document.getElementById('tx-modal-title').textContent = t('tx.modal.editTitle');
    document.getElementById('tx-m-date').value     = tx.date;
    document.getElementById('tx-m-apt').value      = tx.property_id;
    document.getElementById('tx-m-cat').value      = tx.category;
    document.getElementById('tx-m-amount').value   = tx.amount;
    document.getElementById('tx-m-currency').value   = tx.currency || '';
    document.getElementById('tx-m-desc').value       = tx.description;
    document.getElementById('tx-m-notes').value      = tx.notes || '';
    document.getElementById('tx-m-reconciled').checked = !!tx.reconciled;
    document.getElementById('tx-m-reconciled-group').style.display = 'block';
    delBtn.style.display = 'inline-block';

    _hint('tx-m-original-date',   tx.original_date   ? t('tx.modal.originalValue', { value: fmtDate(tx.original_date) }) : '');
    _hint('tx-m-original-amount', tx.original_amount != null ? t('tx.modal.originalValue', { value: parseFloat(tx.original_amount).toLocaleString() }) : '');
    const rawDescDiffers = tx.raw_description && tx.raw_description !== tx.description;
    _hint('tx-m-original-desc',   rawDescDiffers ? t('tx.modal.originalValue', { value: tx.raw_description }) : '');
  } else {
    document.getElementById('tx-modal-title').textContent = t('tx.modal.addTitle');
    document.getElementById('tx-m-date').value     = new Date().toISOString().slice(0,10);
    document.getElementById('tx-m-cat').value      = '';
    document.getElementById('tx-m-amount').value   = '';
    document.getElementById('tx-m-currency').value     = '';
    document.getElementById('tx-m-desc').value         = '';
    document.getElementById('tx-m-notes').value        = '';
    document.getElementById('tx-m-reconciled').checked = false;
    document.getElementById('tx-m-reconciled-group').style.display = 'none';
    delBtn.style.display = 'none';
    _hint('tx-m-original-date',   '');
    _hint('tx-m-original-amount', '');
    _hint('tx-m-original-desc',   '');
  }
  onCategoryChange();
  modal.style.display = 'flex';
}

function closeTxModal() { document.getElementById('modal-tx').style.display = 'none'; }

function onCategoryChange() {
  const cat  = document.getElementById('tx-m-cat').value;
  const hint = document.getElementById('tx-m-notes-hint');
  const lbl  = document.getElementById('tx-m-notes-label');
  const requiresNote = cat && CATEGORIES.expense?.items[cat]?.requiresNote;
  hint.style.display = requiresNote ? 'block' : 'none';
  lbl.textContent    = requiresNote ? t('tx.modal.notesReq') : t('tx.modal.notes');
}

async function saveTxModal() {
  const date     = document.getElementById('tx-m-date').value;
  const propId   = document.getElementById('tx-m-apt').value;
  const cat      = document.getElementById('tx-m-cat').value;
  const amount   = parseFloat(document.getElementById('tx-m-amount').value);
  const currency = document.getElementById('tx-m-currency').value.trim().toUpperCase();
  const desc     = document.getElementById('tx-m-desc').value.trim();
  const notes    = document.getElementById('tx-m-notes').value.trim();

  if (!date || !propId || !cat || !amount) { toast(t('tx.toast.fillReq'), 'error'); return; }
  if (CATEGORIES.expense?.items[cat]?.requiresNote && !notes) { toast(t('tx.toast.noteReq'), 'error'); return; }

  const prop = State.properties.find(p => p.id === propId);
  const type = Importer.categoryToType(cat, State.transactionCategories);

  setLoading(true, t('status.saving'));
  try {
    const data = {
      date,
      type,
      category: cat,
      amount,
      currency: currency || prop?.currency || 'DKK',
      description: desc,
      notes: notes || null,
      source: 'manual',
      ...(State.editingTxId ? {} : { reconciled: false }),
    };

    if (State.editingTxId) {
      data.reconciled = document.getElementById('tx-m-reconciled').checked;
      const existing = State.transactions.find(tx => tx.id === State.editingTxId);
      if (existing) {
        if (existing.original_date == null && date !== existing.date) {
          data.original_date = existing.date;
        }
        if (existing.original_amount == null && amount !== parseFloat(existing.amount)) {
          data.original_amount = parseFloat(existing.amount);
        }
      }
      await Api.updateTransaction(State.editingTxId, data);
      toast(t('tx.toast.updated'), 'success');
    } else {
      await Api.createTransaction(data);
      toast(t('tx.toast.saved'), 'success');
    }
    await refreshAll();
    closeTxModal();
  } catch(e) {
    toast(t('tx.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

async function deleteTxModal() {
  if (!confirm(t('tx.confirmDelete'))) return;
  setLoading(true, t('status.deleting'));
  try {
    // v2 mode: hard delete via API
    await Api.deleteTransaction(State.editingTxId);
    await refreshAll();
    closeTxModal();
    toast(t('tx.toast.deleted'), 'success');
  } catch(e) {
    toast(t('tx.toast.delFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

async function deleteTxWithConfirm(txId) {
  if (!confirm(t('tx.confirmDelete'))) return;
  setLoading(true, t('status.deleting'));
  try {
    await Api.deleteTransaction(txId);
    await refreshAll();
    toast(t('tx.toast.deleted'), 'success');
  } catch(e) {
    toast(t('tx.toast.delFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

// ── Import ────────────────────────────────────────────────

function onProfileChange() {
  const profileKey = document.getElementById('import-profile').value;
  const profile    = BANK_PROFILES[profileKey];
  document.getElementById('import-currency-group').style.display = profile.currency ? 'none' : 'block';
}

// ── Description mappings (backend API) ───────────────────
// State.descMappings holds all mappings for the current user's workspace:
// user-specific (user_id = current user) and global (user_id = null).
// bank_profile = '' means "any profile".

function applyDescMappings(rows, profileKey) {
  const mappings = State.descMappings;
  if (!mappings.length) return;
  rows.forEach(row => {
    const desc = (row.raw_description || row.description || '').toLowerCase();
    const profileMatch = m => m.bank_profile === profileKey || m.bank_profile === '';
    const keywordMatch = m => desc.includes(m.keyword.toLowerCase());
    // User-specific first, then global (user_id === null)
    const match =
      mappings.find(m => m.user_id !== null && profileMatch(m) && keywordMatch(m)) ||
      mappings.find(m => m.user_id === null && profileMatch(m) && keywordMatch(m));
    if (match) {
      row.category           = match.category;
      row.type               = Importer.categoryToType(match.category, State.transactionCategories);
      row._descMappingMatched = true;
      row._autoMatched       = false;
    }
  });
}

async function saveDescMappingsForRows(rows, profileKey) {
  const toStore = rows.filter(r => r._storeMapping && !r._ignored);
  for (const row of toStore) {
    const keyword = (row.raw_description || row.description || '').trim();
    if (!keyword) continue;
    await Api.saveDescMapping({ bank_profile: profileKey, keyword, category: row.category, scope: 'global' });
  }
  if (toStore.length) {
    State.descMappings = await Api.getDescMappings();
  }
}

// ── Row selection ─────────────────────────────────────────

function toggleSelectAll(headerCb) {
  // Three-state: none-selected → select-all; partial or all → deselect-all
  const anySelected = State.importRows.some(r => r._selected);
  const shouldSelect = !anySelected;
  headerCb.checked       = shouldSelect;
  headerCb.indeterminate = false;
  State.importRows.forEach((row, i) => {
    row._selected = shouldSelect;
    const cb = document.getElementById('row-sel-' + i);
    if (cb) cb.checked = shouldSelect;
  });
  _updateLockBtn();
  _rerenderIfGrouped();
}

function onRowSelect(i) {
  const checked = document.getElementById('row-sel-' + i)?.checked;
  if (checked === undefined) return;
  State.importRows[i]._selected = checked;

  // If "select same description" is on and the row is being checked, auto-select all
  // unlocked rows with exactly the same description, then reset the toggle
  const sameDescToggle = document.getElementById('select-same-desc-toggle');
  if (checked && sameDescToggle?.checked) {
    const desc = State.importRows[i].description;
    State.importRows.forEach((row, j) => {
      if (j !== i && row.description === desc && !row._locked) {
        row._selected = true;
        const cb = document.getElementById('row-sel-' + j);
        if (cb) cb.checked = true;
      }
    });
    sameDescToggle.checked = false;
  }

  const anySelected = State.importRows.some(r => r._selected);
  const allSelected = State.importRows.length > 0 && State.importRows.every(r => r._selected);
  const hdr = document.getElementById('select-all-cb');
  if (hdr) {
    hdr.checked       = allSelected;
    hdr.indeterminate = anySelected && !allSelected;
  }
  _updateLockBtn();
  _rerenderIfGrouped();
}

// ── Bulk field change ─────────────────────────────────────

function onRowFieldChange(i, field, value) {
  if (field === 'category' && value === '__new__') {
    const el = document.getElementById('row-cat-' + i);
    if (el) el.value = State.importRows[i].category || '';
    openNewCategoryModal(i);
    return;
  }
  State.importRows[i][field] = value;
  if (field === 'category') {
    State.importRows[i].type = Importer.categoryToType(value, State.transactionCategories);
    State.importRows[i]._userPickedCategory = true;
  }
  if (field === '_storeMapping' && value) State.importRows[i]._userPickedCategory = true;
  if (field === '_ignored')     State.importRows[i]._userPickedIgnore = true;
  if (field === 'property_id') State.importRows[i]._userPickedProperty = true;
  if (field === 'property_id' || field === 'description') _checkSingleRowDuplicate(i);
  _applyRowStyle(i);

  const bulkOn = document.getElementById('bulk-update-toggle')?.checked;
  if (bulkOn && State.importRows[i]._selected) {
    State.importRows.forEach((row, j) => {
      if (j === i || !row._selected || row._locked) return;
      row[field] = value;
      if (field === 'category') {
        row.type = Importer.categoryToType(value, State.transactionCategories);
        row._userPickedCategory = true;
      }
      if (field === '_storeMapping' && value) row._userPickedCategory = true;
      _syncRowDOM(j, field, value);
      _applyRowStyle(j);
    });
  }
  _rerenderIfGrouped();
}

function _syncRowDOM(j, field, value) {
  const map = { property_id: 'row-prop-', category: 'row-cat-', notes: 'row-notes-', _ignored: 'row-ign-', _storeMapping: 'row-map-' };
  const prefix = map[field];
  if (!prefix) return;
  const el = document.getElementById(prefix + j);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = value;
  else el.value = value;
}

function _applyRowStyle(i) {
  const tr = document.querySelector('tr[data-row="' + i + '"]');
  if (!tr) return;
  const row = State.importRows[i];
  if (row._ignored) tr.classList.add('preview-row-ignored');
  else              tr.classList.remove('preview-row-ignored');

  if (row._isDuplicate) tr.classList.add('preview-row-dup');
  else                  tr.classList.remove('preview-row-dup');

  const warnResolved = row._isDuplicate || row._ignored || row._autoMatched || row._descMappingMatched || row._userPickedCategory || row._storeMapping;
  if (warnResolved) tr.classList.remove('preview-row-warn');
  else              tr.classList.add('preview-row-warn');

  const notesEl = document.getElementById('row-notes-' + i);
  if (notesEl) {
    const skipNotes = document.getElementById('import-skip-notes-toggle')?.checked;
    const needsNote = !skipNotes && !row._ignored && !row._locked && row.category === 'other_expense' && !(row.notes || '').trim();
    notesEl.style.background = needsNote ? 'var(--error-bg, #ffeaea)' : '';
  }
}

function _buildRowHtml(row, i) {
  const locked    = row._locked;
  const dis       = locked ? ' disabled' : '';
  const propOpts  = State.properties.map(p =>
    `<option value="${p.id}"${p.id === row.property_id ? ' selected' : ''}>${p.name}</option>`
  ).join('');
  const catOpts   = Importer.buildCategoryOptions(row.category, State.transactionCategories);
  const warnClass = (!row._autoMatched && !row._descMappingMatched && !locked) ? 'preview-row-warn' : '';
  const dupClass  = row._isDuplicate ? ' preview-row-dup' : '';
  const ignClass  = row._ignored     ? ' preview-row-ignored' : '';
  const lockClass = locked           ? ' preview-row-locked' : '';
  const amtSign   = row.type === 'expense' ? '-' : '';
  const amtCls    = row.type === 'expense' ? 'negative' : 'positive';
  const skipNotes = document.getElementById('import-skip-notes-toggle')?.checked;
  const notesBg   = !skipNotes && !locked && row.category === 'other_expense' && !(row.notes || '').trim() ? ';background:var(--error-bg,#ffeaea)' : '';
  return `<tr data-row="${i}" class="${warnClass}${dupClass}${ignClass}${lockClass}">
    <td style="text-align:center"><input type="checkbox" id="row-sel-${i}" onchange="onRowSelect(${i})"${row._selected ? ' checked' : ''}></td>
    <td>${fmtDate(row.date)}</td>
    <td style="max-width:160px;font-size:12px">${row.description}</td>
    <td><select id="row-prop-${i}" style="font-size:12px;padding:4px 6px" onchange="onRowFieldChange(${i},'property_id',this.value)"${dis}><option value="">—</option>${propOpts}</select></td>
    <td><span id="row-tags-${i}">${_buildMatchTag(row)}</span><select id="row-cat-${i}" style="font-size:12px;padding:4px 6px" onchange="onRowFieldChange(${i},'category',this.value)"${dis}>${catOpts}</select></td>
    <td><input id="row-notes-${i}" style="font-size:12px;padding:4px 6px;width:120px${notesBg}" placeholder="notes…" value="${escHtml(row.notes || '')}" oninput="onRowFieldChange(${i},'notes',this.value)"${dis}></td>
    <td class="amount-cell ${amtCls}">${amtSign}${row.amount.toLocaleString()} ${_importCurrency}</td>
    <td style="text-align:center"><input type="checkbox" id="row-ign-${i}" onchange="onRowFieldChange(${i},'_ignored',this.checked)"${row._ignored ? ' checked' : ''}${dis}></td>
    <td style="text-align:center"><input type="checkbox" id="row-map-${i}" onchange="onRowFieldChange(${i},'_storeMapping',this.checked)"${row._storeMapping ? ' checked' : ''}${dis}></td>
  </tr>`;
}

function _rowSection(row) {
  if (row._isDuplicate)                                  return 4;
  if (row._ignored)                                      return 5;
  if (row._userPickedCategory || row._userPickedProperty) return 3;
  if (row._autoMatched || row._descMappingMatched)        return 2;
  return 1;
}

function _sortVal(row, col) {
  switch (col) {
    case 'date':        return row.date || '';
    case 'description': return (row.description || '').toLowerCase();
    case 'property':    return (State.properties.find(p => p.id === row.property_id)?.name || '').toLowerCase();
    case 'category':    return row.category || '';
    case 'notes':       return (row.notes || '').toLowerCase();
    case 'amount':      return row.amount || 0;
    default:            return '';
  }
}

function renderImportTable() {
  const tbody   = document.getElementById('import-preview-body');
  if (!tbody || !State.importRows.length) return;
  const groupOn = document.getElementById('import-group-toggle')?.checked;
  const floatOn = document.getElementById('import-float-toggle')?.checked;

  // Locked rows are always rendered at the very bottom, independent of sort/group/float
  const indexed = State.importRows.map((row, i) => ({ row, i })).filter(({ row }) => !row._locked);
  const lockedItems = State.importRows.map((row, i) => ({ row, i })).filter(({ row }) => row._locked);

  if (_importSortCol) {
    const dir = _importSortDir === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      const va = _sortVal(a.row, _importSortCol);
      const vb = _sortVal(b.row, _importSortCol);
      return va < vb ? -dir : va > vb ? dir : 0;
    };
    indexed.sort(cmp);
    lockedItems.sort(cmp);
  }

  let html = '';

  if (floatOn) {
    const sel = indexed.filter(({ row }) => row._selected);
    if (sel.length) {
      html += `<tr class="import-section-hdr"><td colspan="9"><span class="chevron">▼</span> ${t('import.sections.selected')} (${sel.length})</td></tr>`;
      sel.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
    }
  }

  const rest = floatOn ? indexed.filter(({ row }) => !row._selected) : indexed;

  if (groupOn) {
    const SECTIONS = [
      { id: 1, key: 'unreviewed'  },
      { id: 2, key: 'autoMatched' },
      { id: 3, key: 'reviewed'    },
      { id: 4, key: 'duplicate'   },
      { id: 5, key: 'ignored'     },
    ];
    for (const sec of SECTIONS) {
      const rows = rest.filter(({ row }) => _rowSection(row) === sec.id);
      if (!rows.length) continue;
      const collapsed = _groupCollapsed[sec.id];
      const chevron   = collapsed ? '▶' : '▼';
      html += `<tr class="import-section-hdr" onclick="toggleImportSection(${sec.id})"><td colspan="9"><span class="chevron">${chevron}</span> ${t('import.sections.' + sec.key)} (${rows.length})</td></tr>`;
      if (!collapsed) rows.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
    }
  } else {
    rest.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
  }

  // Locked ("Finished") section always at the very bottom
  if (lockedItems.length) {
    const collapsed = _groupCollapsed[6];
    const chevron   = collapsed ? '▶' : '▼';
    html += `<tr class="import-section-hdr" onclick="toggleImportSection(6)"><td colspan="9"><span class="chevron">${chevron}</span> ${t('import.sections.locked')} (${lockedItems.length})</td></tr>`;
    if (!collapsed) lockedItems.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
  }

  tbody.innerHTML = html;
}

function toggleImportSection(id) {
  _groupCollapsed[id] = !_groupCollapsed[id];
  renderImportTable();
}

function _rerenderIfGrouped() {
  const groupOn = document.getElementById('import-group-toggle')?.checked;
  const floatOn = document.getElementById('import-float-toggle')?.checked;
  if (groupOn || floatOn) renderImportTable();
}

// ── Row locking (F5-9) ────────────────────────────────────

function _updateLockBtn() {
  const btn = document.getElementById('import-lock-btn');
  if (!btn) return;
  const selected = State.importRows.filter(r => r._selected);
  if (!selected.length) { btn.style.display = 'none'; return; }
  const allLocked  = selected.every(r => r._locked);
  const noneLocked = selected.every(r => !r._locked);
  if (noneLocked) {
    btn.style.display = '';
    btn.textContent   = t('import.lockBtn');
  } else if (allLocked) {
    btn.style.display = '';
    btn.textContent   = t('import.unlockBtn');
  } else {
    btn.style.display = 'none';
  }
}

function onImportLockBtnClick() {
  const selected = State.importRows.filter(r => r._selected);
  if (selected.every(r => !r._locked)) lockSelectedRows();
  else if (selected.every(r => r._locked)) unlockSelectedRows();
}

function lockSelectedRows() {
  State.importRows.forEach((row, i) => {
    if (row._selected && !row._locked) {
      row._locked   = true;
      row._selected = false;
      const cb = document.getElementById('row-sel-' + i);
      if (cb) cb.checked = false;
    }
  });
  const hdr = document.getElementById('select-all-cb');
  if (hdr) { hdr.checked = false; hdr.indeterminate = false; }
  _updateLockBtn();
  renderImportTable();
}

function unlockSelectedRows() {
  State.importRows.forEach(row => { if (row._selected && row._locked) row._locked = false; });
  _updateLockBtn();
  renderImportTable();
}

// ── Column sort (F5-10) ───────────────────────────────────

function sortImportCol(col) {
  if (_importSortCol === col) {
    _importSortDir = _importSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _importSortCol = col;
    _importSortDir = 'asc';
  }
  _updateImportSortIndicators();
  renderImportTable();
}

function _updateImportSortIndicators() {
  ['date', 'description', 'property', 'category', 'notes', 'amount'].forEach(col => {
    const el = document.getElementById('import-sort-ind-' + col);
    if (el) el.textContent = _importSortCol === col ? (_importSortDir === 'asc' ? ' ▲' : ' ▼') : '';
  });
}

function _applyDupResult(i, match) {
  const row = State.importRows[i];
  const wasDup = row._isDuplicate;

  row._isDuplicate   = !!match;
  row._duplicateMatch = match || null;

  if (match && !row._userPickedIgnore) {
    row._ignored = true;
    const cb = document.getElementById('row-ign-' + i);
    if (cb) cb.checked = true;
  } else if (!match && wasDup && !row._userPickedIgnore) {
    row._ignored = false;
    const cb = document.getElementById('row-ign-' + i);
    if (cb) cb.checked = false;
  }

  const tagsEl = document.getElementById('row-tags-' + i);
  if (tagsEl) tagsEl.innerHTML = _buildMatchTag(row);

  _applyRowStyle(i);
  _rerenderIfGrouped();
}

async function _batchCheckDuplicates() {
  const indexed = State.importRows
    .map((row, i) => ({ i, row }))
    .filter(({ row }) => row.property_id);

  if (!indexed.length) return;

  const payload = indexed.map(({ row }) => ({
    property_id: row.property_id,
    date:        row.date,
    description: row.description,
    amount:      row.amount,
  }));

  try {
    const results = await Api.checkImportDuplicates(payload);
    indexed.forEach(({ i }, j) => _applyDupResult(i, results[j]));
  } catch (_) {
    // Non-critical — silent failure
  }
}

async function _checkSingleRowDuplicate(i) {
  const row = State.importRows[i];
  if (!row.property_id) {
    _applyDupResult(i, null);
    return;
  }

  try {
    const results = await Api.checkImportDuplicates([{
      property_id: row.property_id,
      date:        row.date,
      description: row.description,
      amount:      row.amount,
    }]);
    _applyDupResult(i, results[0]);
  } catch (_) {
    // Non-critical
  }
}

// ── Import file / paste toggle ────────────────────────────

let _importCSVText  = '';   // holds text loaded from a file
let _importCurrency = '';   // currency label shown in amount column
let _groupCollapsed = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
let _importSortCol  = null;
let _importSortDir  = 'asc';

function _updatePreviewBtnState() {
  const hasData = !!_importCSVText || !!(document.getElementById('import-csv')?.value.trim());
  const btn  = document.getElementById('import-preview-btn');
  const hint = document.getElementById('import-preview-hint');
  if (!btn) return;
  btn.disabled = !hasData;
  if (hint) hint.style.display = hasData ? 'none' : 'inline';
}

function _setFileLoaded(text, name) {
  _importCSVText = text;
  document.getElementById('import-file-name').textContent = name;
  document.getElementById('import-file-name').style.display = 'inline-block';
  document.getElementById('import-zone').querySelector('strong').textContent = '✓ ' + name;
  showMappingPanel(text, document.getElementById('import-profile').value);
  _updatePreviewBtnState();
}

function onImportFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => _setFileLoaded(e.target.result, file.name);
  reader.readAsText(file);
}

function onImportDragOver(event) {
  event.preventDefault();
  document.getElementById('import-zone').classList.add('import-zone--active');
  document.getElementById('import-zone').querySelector('strong').textContent = t('import.dropZoneActive');
}

function onImportDragLeave(event) {
  document.getElementById('import-zone').classList.remove('import-zone--active');
  document.getElementById('import-zone').querySelector('strong').textContent = t('import.dropZone');
}

function onImportDrop(event) {
  event.preventDefault();
  document.getElementById('import-zone').classList.remove('import-zone--active');
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => _setFileLoaded(e.target.result, file.name);
  reader.readAsText(file);
}

function toggleImportPaste() {
  const pasteArea = document.getElementById('import-paste-area');
  const link      = document.getElementById('import-paste-link');
  const shown     = pasteArea.style.display !== 'none';
  pasteArea.style.display = shown ? 'none' : 'block';
  link.textContent = shown ? t('import.pasteToggle') : t('import.fileToggle');
}

function clearImport() {
  _importCSVText = '';
  document.getElementById('import-file').value = '';
  document.getElementById('import-file-name').style.display = 'none';
  document.getElementById('import-zone').querySelector('strong').textContent = t('import.dropZone');
  document.getElementById('import-csv').value = '';
  document.getElementById('import-mapping-section').style.display = 'none';
  document.getElementById('import-preview-section').style.display = 'none';
  document.getElementById('import-static-section').style.display = 'none';
  document.getElementById('import-mapping-confirm-section').style.display = 'none';
  _updatePreviewBtnState();
}

// ── Column mapping ────────────────────────────────────────

const MAPPING_STORAGE_KEY = 'lg_col_mappings_v1';

function getSavedMappings() {
  try { return JSON.parse(localStorage.getItem(MAPPING_STORAGE_KEY) || '{}'); }
  catch(e) { return {}; }
}

function refreshSavedMappingsDropdown() {
  const sel     = document.getElementById('mapping-saved-select');
  const current = sel.value;
  const names   = Object.keys(getSavedMappings());
  sel.innerHTML = `<option value="">${t('import.mapping.noSaved')}</option>`
    + names.map(n => `<option value="${n}"${n === current ? ' selected' : ''}>${n}</option>`).join('');
}

function _setSelectValue(el, val) {
  for (const opt of el.options) {
    if (opt.value === val) { opt.selected = true; return; }
  }
}

function showMappingPanel(csvText, profileKey) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return;

  const profile   = BANK_PROFILES[profileKey] || {};
  const skipRows  = profile.skip_rows ?? 1;
  const delimiter = Importer.detectDelimiter(lines[0]);
  const headers   = Importer.splitCSVLine(lines[0], delimiter);
  const sampleIdx = Math.min(skipRows, lines.length - 1);
  const sample    = Importer.splitCSVLine(lines[sampleIdx] || '', delimiter);
  const detected  = Importer.detectColumns(headers, profile);

  // Seed format selects from profile
  if (profile.date_format)    _setSelectValue(document.getElementById('mapping-date-format'), profile.date_format);
  if (profile.amount_decimal) _setSelectValue(document.getElementById('mapping-decimal'),     profile.amount_decimal);
  if (profile.currency)       _setSelectValue(document.getElementById('mapping-currency-sel'), profile.currency);
  document.getElementById('mapping-skip-rows').value = skipRows;

  // Render one row per CSV column
  const roles = ['date', 'description', 'amount', 'ignore'];
  document.getElementById('mapping-table-body').innerHTML = headers.map((h, i) => {
    let autoRole = 'ignore';
    if      (detected.date_col        === i) autoRole = 'date';
    else if (detected.description_col === i) autoRole = 'description';
    else if (detected.amount_col      === i) autoRole = 'amount';

    const roleOpts  = roles.map(r =>
      `<option value="${r}"${r === autoRole ? ' selected' : ''}>${t('import.mapping.roles.' + r)}</option>`
    ).join('');
    const sampleVal = (sample[i] || '').replace(/^"|"$/g, '').slice(0, 40);

    return `<tr>
      <td style="font-size:12px;font-weight:500;padding:4px 8px">${h.replace(/^"|"$/g, '')}</td>
      <td style="font-size:11px;color:var(--text3);padding:4px 8px">${sampleVal}</td>
      <td style="padding:4px 8px">
        <select class="mapping-role-sel" data-col="${i}" style="font-size:12px;padding:3px 6px">
          ${roleOpts}
        </select>
      </td>
    </tr>`;
  }).join('');

  refreshSavedMappingsDropdown();
  document.getElementById('import-mapping-section').style.display = 'block';
}

function buildColumnMap() {
  const csvText   = _importCSVText || document.getElementById('import-csv').value;
  const firstLine = csvText.split(/\r?\n/).find(l => l.trim()) || '';
  const map = {
    date_col:        -1,
    description_col: -1,
    amount_col:      -1,
    delimiter:       Importer.detectDelimiter(firstLine),
    date_format:     document.getElementById('mapping-date-format').value,
    amount_decimal:  document.getElementById('mapping-decimal').value,
    currency:        document.getElementById('mapping-currency-sel').value,
    skip_rows:       parseInt(document.getElementById('mapping-skip-rows').value, 10) || 1,
  };
  document.querySelectorAll('.mapping-role-sel').forEach(sel => {
    const col  = parseInt(sel.dataset.col, 10);
    const role = sel.value;
    if      (role === 'date')        map.date_col        = col;
    else if (role === 'description') map.description_col = col;
    else if (role === 'amount')      map.amount_col      = col;
  });
  return map;
}

function applyMappingToUI(saved) {
  _setSelectValue(document.getElementById('mapping-date-format'),  saved.date_format    || 'YYYY-MM-DD');
  _setSelectValue(document.getElementById('mapping-decimal'),      saved.amount_decimal || '.');
  _setSelectValue(document.getElementById('mapping-currency-sel'), saved.currency       || 'DKK');
  if (saved.skip_rows !== undefined)
    document.getElementById('mapping-skip-rows').value = saved.skip_rows;

  document.querySelectorAll('.mapping-role-sel').forEach(sel => {
    const col = parseInt(sel.dataset.col, 10);
    let role = 'ignore';
    if      (saved.date_col        === col) role = 'date';
    else if (saved.description_col === col) role = 'description';
    else if (saved.amount_col      === col) role = 'amount';
    _setSelectValue(sel, role);
  });
}

function loadSavedMapping() {
  const name = document.getElementById('mapping-saved-select').value;
  if (!name) return;
  const saved = getSavedMappings()[name];
  if (saved) applyMappingToUI(saved);
}

function saveCurrentMapping() {
  const name = document.getElementById('mapping-name-input').value.trim();
  if (!name) { toast(t('import.mapping.toast.noName'), 'error'); return; }
  const mappings = getSavedMappings();
  mappings[name] = buildColumnMap();
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings));
  refreshSavedMappingsDropdown();
  document.getElementById('mapping-saved-select').value = name;
  document.getElementById('mapping-name-input').value   = '';
  toast(t('import.mapping.toast.saved', { name }), 'success');
}

function deleteSavedMapping() {
  const name = document.getElementById('mapping-saved-select').value;
  if (!name) return;
  const mappings = getSavedMappings();
  delete mappings[name];
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings));
  refreshSavedMappingsDropdown();
  toast(t('import.mapping.toast.deleted', { name }), 'success');
}

async function runImportPreview() {
  const pasteText  = document.getElementById('import-csv').value.trim();
  const csv        = _importCSVText || pasteText;
  const profileKey = document.getElementById('import-profile').value;
  const propId     = document.getElementById('import-apt').value;

  if (!csv) { toast(t('import.toast.noData'), 'error'); return; }

  // Show/refresh mapping panel if not visible
  if (document.getElementById('import-mapping-section').style.display === 'none') {
    showMappingPanel(csv, profileKey);
  }

  const colMap = buildColumnMap();

  let result;
  try {
    result = Importer.parseCSV(csv, profileKey, propId, State.rules, colMap);
  } catch(e) {
    toast(t('import.toast.parseError', { error: e.message }), 'error');
    return;
  }

  // Apply description mappings (highest priority — overrides rule matches)
  applyDescMappings(result.rows, profileKey);

  // Initialise per-row UI flags
  State.importRows = result.rows.map(r => Object.assign(r, { _selected: false, _ignored: false, _locked: false, _storeMapping: false, _userPickedCategory: false, _userPickedProperty: false, _isDuplicate: false, _duplicateMatch: null, _userPickedIgnore: false }));

  _importCurrency = result.currency || '';
  _groupCollapsed = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  _importSortCol  = null;
  _importSortDir  = 'asc';
  _updateImportSortIndicators();
  _updateLockBtn();
  const groupToggle = document.getElementById('import-group-toggle');
  const floatToggle = document.getElementById('import-float-toggle');
  if (groupToggle) groupToggle.checked = false;
  if (floatToggle) floatToggle.checked = false;

  document.getElementById('import-preview-title').textContent =
    `Preview — ${result.rows.length} rows from ${result.profileLabel}`;

  renderImportTable();

  const errDiv = document.getElementById('import-errors');
  if (result.errors.length) {
    errDiv.innerHTML = `<p style="font-size:12px;color:var(--amber)">⚠ ${result.errors.length} rows skipped:</p>`
      + result.errors.map(e => `<div style="font-size:11px;color:var(--text3)">Line ${e.line}: ${e.reason}</div>`).join('');
  } else {
    errDiv.innerHTML = '';
  }

  const selAllCb = document.getElementById('select-all-cb');
  if (selAllCb) { selAllCb.checked = false; selAllCb.indeterminate = false; }
  document.getElementById('import-static-section').style.display = 'none';
  document.getElementById('import-mapping-confirm-section').style.display = 'none';
  const preview = document.getElementById('import-preview-section');
  preview.style.display = 'block';
  preview.scrollIntoView({ behavior: 'smooth' });

  // Batch-check for duplicates (async, non-blocking render)
  _batchCheckDuplicates();

}

// ── Step navigation ───────────────────────────────────────

function goToStaticPreview() {
  const activeRows = State.importRows.filter(r => !r._ignored && !r._locked);
  if (!activeRows.length) { toast(t('import.toast.noActiveRows'), 'error'); return; }

  const skipNotes = document.getElementById('import-skip-notes-toggle')?.checked;
  if (!skipNotes) {
    const missingNotes = activeRows.filter(r => r.category === 'other_expense' && !(r.notes || '').trim());
    if (missingNotes.length) { toast(t('import.toast.notesRequired', { count: missingNotes.length }), 'error'); return; }
  }

  const profileKey  = document.getElementById('import-profile').value;
  const hasToStore  = activeRows.some(r => r._storeMapping);
  document.getElementById('static-next-btn').textContent =
    hasToStore ? t('import.staticPreview.nextBtn') : t('import.staticPreview.importBtn');

  // Build two-level tree: type → category
  const TYPE_ORDER = ['income', 'expense', 'deposit', 'transfer'];
  const groups = {};
  activeRows.forEach(row => {
    const type = row.type || 'expense';
    const cat  = row.category || 'other_expense';
    if (!groups[type])      groups[type] = {};
    if (!groups[type][cat]) groups[type][cat] = [];
    groups[type][cat].push(row);
  });

  let html = '';
  TYPE_ORDER.forEach(type => {
    if (!groups[type]) return;
    const allTypeRows = Object.values(groups[type]).flat();
    const typeCount   = allTypeRows.length;
    const currencies  = [...new Set(allTypeRows.map(r => r.currency))];
    const typeMeta    = currencies.length === 1
      ? `${typeCount} transactions · ${allTypeRows.reduce((s, r) => s + r.amount, 0).toLocaleString()} ${currencies[0]}`
      : `${typeCount} transactions`;

    html += `<div class="tree-group">
      <div class="tree-group-header" onclick="toggleTree(this)">
        <span class="tree-toggle">▼</span>
        <strong>${t('categories.' + type)}</strong>
        <span class="tree-meta">${typeMeta}</span>
      </div>
      <div class="tree-group-body">`;

    Object.entries(groups[type]).forEach(([cat, rows]) => {
      const catCount = rows.length;
      const catCurs  = [...new Set(rows.map(r => r.currency))];
      const catMeta  = catCurs.length === 1
        ? `${catCount} rows · ${rows.reduce((s, r) => s + r.amount, 0).toLocaleString()} ${catCurs[0]}`
        : `${catCount} rows`;

      html += `<div class="tree-cat">
        <div class="tree-cat-header" onclick="toggleTree(this)">
          <span class="tree-toggle">▼</span>
          <span>${catLabel(cat)}</span>
          <span class="tree-meta">${catMeta}</span>
        </div>
        <div class="tree-cat-body">
          <table class="tree-table">
            <thead><tr>
              <th>${t('import.col.date')}</th>
              <th>${t('import.col.description')}</th>
              <th>${t('import.col.property')}</th>
              <th>${t('import.col.notes')}</th>
              <th class="amount-cell">${t('import.col.amount')}</th>
            </tr></thead>
            <tbody>${rows.map(row => {
              const prop = State.properties.find(p => p.id === row.property_id);
              return `<tr>
                <td>${fmtDate(row.date)}</td>
                <td style="font-size:12px;max-width:200px">${row.description}</td>
                <td style="font-size:12px">${prop ? prop.name : '—'}</td>
                <td style="font-size:12px">${row.notes || '—'}</td>
                <td class="amount-cell">${row.amount.toLocaleString()} ${row.currency}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    });

    html += `</div></div>`;
  });

  document.getElementById('import-static-body').innerHTML = html;
  document.getElementById('import-preview-section').style.display = 'none';
  document.getElementById('import-mapping-confirm-section').style.display = 'none';
  const section = document.getElementById('import-static-section');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth' });
}

function toggleTree(header) {
  const body    = header.nextElementSibling;
  const toggle  = header.querySelector('.tree-toggle');
  const isOpen  = body.style.display !== 'none';
  body.style.display  = isOpen ? 'none' : '';
  toggle.textContent  = isOpen ? '▶' : '▼';
}

function backToEditPreview() {
  document.getElementById('import-static-section').style.display = 'none';
  const s = document.getElementById('import-preview-section');
  s.style.display = 'block';
  s.scrollIntoView({ behavior: 'smooth' });
}

function goToMappingConfirmOrImport() {
  const profileKey = document.getElementById('import-profile').value;
  const activeRows = State.importRows.filter(r => !r._ignored && !r._locked);
  const toStore    = activeRows.filter(r => r._storeMapping);

  if (!toStore.length) { doImport(false); return; }

  // Build mapping confirmation lists
  const existing = State.descMappings;
  const toAdd    = [];
  const toUpdate = [];

  toStore.forEach(row => {
    const keyword = (row.raw_description || row.description || '').trim();
    const found   = existing.find(m => m.bank_profile === profileKey && m.user_id === null && m.keyword === keyword);
    if (found) {
      if (found.category !== row.category)
        toUpdate.push({ keyword, oldCat: found.category, newCat: row.category });
      // same category → no change, skip
    } else {
      toAdd.push({ keyword, category: row.category });
    }
  });

  const th = s => `<th style="text-align:left;padding:3px 8px;font-size:11px">${s}</th>`;
  const td = s => `<td style="padding:3px 8px;font-size:11px">${s}</td>`;
  let html = '';

  if (toAdd.length) {
    html += `<p style="font-size:13px;font-weight:500;margin-bottom:0.4rem">${t('import.mappingConfirm.newLabel', { count: toAdd.length })}</p>
      <div class="table-wrap" style="margin-bottom:1rem"><table><thead><tr>
        ${th(t('import.mappingConfirm.colDesc'))}${th(t('import.mappingConfirm.colCat'))}
      </tr></thead><tbody>
        ${toAdd.map(m => `<tr>${td(m.keyword)}<td style="padding:3px 8px"><span class="tag">${catLabel(m.category)}</span></td></tr>`).join('')}
      </tbody></table></div>`;
  }

  if (toUpdate.length) {
    html += `<p style="font-size:13px;font-weight:500;margin-bottom:0.4rem">${t('import.mappingConfirm.updateLabel', { count: toUpdate.length })}</p>
      <div class="table-wrap"><table><thead><tr>
        ${th(t('import.mappingConfirm.colDesc'))}${th(t('import.mappingConfirm.colWas'))}${th(t('import.mappingConfirm.colNow'))}
      </tr></thead><tbody>
        ${toUpdate.map(m => `<tr>${td(m.keyword)}
          <td style="padding:3px 8px"><span class="tag">${catLabel(m.oldCat)}</span></td>
          <td style="padding:3px 8px"><span class="tag">${catLabel(m.newCat)}</span></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }

  if (!toAdd.length && !toUpdate.length) {
    html = `<p style="font-size:13px;color:var(--text3)">${t('import.mappingConfirm.noChanges')}</p>`;
  }

  document.getElementById('import-mapping-confirm-body').innerHTML = html;
  document.getElementById('import-static-section').style.display = 'none';
  const s = document.getElementById('import-mapping-confirm-section');
  s.style.display = 'block';
  s.scrollIntoView({ behavior: 'smooth' });
}

function backToStaticPreview() {
  document.getElementById('import-mapping-confirm-section').style.display = 'none';
  const s = document.getElementById('import-static-section');
  s.style.display = 'block';
  s.scrollIntoView({ behavior: 'smooth' });
}

async function doImport(saveMappings) {
  const profileKey = document.getElementById('import-profile').value;
  const activeRows = State.importRows.filter(r => !r._ignored && !r._locked);
  if (!activeRows.length) return;

  const missing = activeRows.filter(r => !r.property_id);
  if (missing.length) {
    if (!confirm(t('import.confirmMissing', { count: missing.length }))) return;
  }

  setLoading(true, t('status.importing'));
  try {
    if (saveMappings) await saveDescMappingsForRows(activeRows, profileKey);
    const toSave = activeRows.map(row => {
      const prop = State.properties.find(p => p.id === row.property_id);
      return {
        ...row,
        account_id: prop?.account_id ?? null,
        // property_id kept from row — backend stores it directly
      };
    });
    const result = await Api.importTransactions(toSave);
    const batchId = result.import_batch;
    toast(t('import.toast.done', { count: result.inserted, batchId }), 'success');
    State.importRows = [];
    clearImport();
    await Promise.all([refreshAll(), loadImportHistory(true)]);
  } catch(e) {
    toast(t('import.toast.failed', { error: e.message }), 'error');
  }
  setLoading(false);
}

// ── Import history ────────────────────────────────────────

let _importHistoryCollapsed = true;

async function loadImportHistory(expand = false) {
  if (expand) {
    _importHistoryCollapsed = false;
    document.getElementById('import-history-body').style.display = '';
    document.getElementById('import-history-chevron').textContent = '▼';
  }
  try {
    const batches = await Api.getImportHistory();
    renderImportHistory(batches);
  } catch (_) {
    // non-critical; silently ignore
  }
}

function renderImportHistory(batches) {
  const tbody = document.getElementById('import-history-body-rows');
  if (!batches.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);padding:0.75rem">${t('import.history.empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = batches.map(b => {
    const date = fmtDateTime(b.imported_at);
    const undoBtn = `<button class="btn btn-sm btn-danger" onclick="undoImportBatch('${b.import_batch}',${b.row_count})">${t('import.history.undoBtn')}</button>`;
    return `<tr>
      <td>${date}</td>
      <td>${b.source || '—'}</td>
      <td>${b.row_count}</td>
      <td>${b.properties || '—'}</td>
      <td>${undoBtn}</td>
    </tr>`;
  }).join('');
}

function toggleImportHistory() {
  _importHistoryCollapsed = !_importHistoryCollapsed;
  const body = document.getElementById('import-history-body');
  const chevron = document.getElementById('import-history-chevron');
  body.style.display = _importHistoryCollapsed ? 'none' : '';
  chevron.textContent = _importHistoryCollapsed ? '▶' : '▼';
  if (!_importHistoryCollapsed) loadImportHistory();
}

let _undoBatchId = null;
let _undoRowCount = 0;

async function undoImportBatch(batchId, rowCount) {
  _undoBatchId = batchId;
  _undoRowCount = rowCount;

  const modal = document.getElementById('modal-undo-import');
  const subtitle = document.getElementById('undo-modal-subtitle');
  const tbody = document.getElementById('undo-modal-rows');
  const confirmBtn = document.getElementById('undo-modal-confirm-btn');

  subtitle.textContent = t('import.history.modal.subtitle', { count: rowCount });
  confirmBtn.textContent = t('import.history.modal.confirmBtn', { count: rowCount });
  tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted)">${t('import.history.modal.loading')}</td></tr>`;
  modal.style.display = 'flex';

  try {
    const data = await Api.getTransactions({ import_batch: batchId, limit: 500 });
    const rows = data.data || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted)">No transactions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(tx => {
      const prop = State.properties.find(p => p.id === tx.property_id);
      return `<tr>
        <td>${prop ? prop.name : '—'}</td>
        <td>${fmtDate(tx.date)}</td>
        <td>${tx.description || '—'}</td>
        <td>${catLabel(tx.category)}</td>
        <td style="text-align:right">${parseFloat(tx.amount).toFixed(2)} ${tx.currency}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--danger)">Failed to load: ${e.message}</td></tr>`;
  }
}

function closeUndoModal() {
  document.getElementById('modal-undo-import').style.display = 'none';
  _undoBatchId = null;
  _undoRowCount = 0;
}

async function confirmUndoImport() {
  if (!_undoBatchId) return;
  try {
    const result = await Api.deleteImportBatch(_undoBatchId);
    closeUndoModal();
    toast(t('import.history.undone', { count: result.deleted }), 'success');
    await Promise.all([refreshAll(), loadImportHistory()]);
  } catch (e) {
    toast(t('import.history.undoFailed', { error: e.message }), 'error');
  }
}

// ── Reports ───────────────────────────────────────────────

let repIncomeTable  = null;
let repExpenseTable = null;
let repPnlTable     = null;
let _repIncCats  = [];
let _repExpCats  = [];
let _repPnlRows  = [];

function initReportTables() {
  repIncomeTable = DataTable.create({
    containerId: 'rep-income-table-wrap',
    title: t('reports.incomeByCat'),
    columns: [
      { key: 'category', label: t('reports.col.category'), sortable: true },
      { key: 'amount',   label: t('reports.col.amount'),   sortable: true, align: 'right' },
      { key: 'count',    label: t('reports.col.count'),    sortable: true, align: 'right' },
    ],
    fetchData: async () => ({ data: _repIncCats,  total: _repIncCats.length }),
    renderRow: (c) => `<tr>
      <td data-col="category">${catLabel(c.category)}</td>
      <td data-col="amount" class="amount-cell positive">${c.amount.toLocaleString()}</td>
      <td data-col="count"  class="amount-cell muted">${c.count}</td>
    </tr>`,
    columnVisibility: { enabled: true, storageKey: 'datatable-rep-income' },
  });

  repExpenseTable = DataTable.create({
    containerId: 'rep-expense-table-wrap',
    title: t('reports.expensesByCat'),
    columns: [
      { key: 'category', label: t('reports.col.category'), sortable: true },
      { key: 'amount',   label: t('reports.col.amount'),   sortable: true, align: 'right' },
      { key: 'count',    label: t('reports.col.count'),    sortable: true, align: 'right' },
    ],
    fetchData: async () => ({ data: _repExpCats, total: _repExpCats.length }),
    renderRow: (c) => `<tr>
      <td data-col="category">${catLabel(c.category)}</td>
      <td data-col="amount" class="amount-cell negative">${c.amount.toLocaleString()}</td>
      <td data-col="count"  class="amount-cell muted">${c.count}</td>
    </tr>`,
    columnVisibility: { enabled: true, storageKey: 'datatable-rep-expense' },
  });

  repPnlTable = DataTable.create({
    containerId: 'rep-pnl-table-wrap',
    title: t('reports.pnlByProperty'),
    columns: [
      { key: 'property',  label: t('reports.col.property'),  sortable: true },
      { key: 'income',    label: t('reports.col.income'),    sortable: true, align: 'right' },
      { key: 'expenses',  label: t('reports.col.expenses'),  sortable: true, align: 'right' },
      { key: 'net',       label: t('reports.col.net'),       sortable: true, align: 'right' },
    ],
    fetchData: async () => ({ data: _repPnlRows, total: _repPnlRows.length }),
    renderRow: (d) => `<tr>
      <td data-col="property">${d.name}</td>
      <td data-col="income"   class="amount-cell positive">${Reports.fmt(d.income,   d.currency)}</td>
      <td data-col="expenses" class="amount-cell negative">${Reports.fmt(d.expenses, d.currency)}</td>
      <td data-col="net"      class="amount-cell ${d.net >= 0 ? 'positive' : 'negative'}">${Reports.fmt(d.net, d.currency)}</td>
    </tr>`,
    columnVisibility: { enabled: true, storageKey: 'datatable-rep-pnl' },
  });
}

function setReportYear(year) {
  if (!year) { renderReports(); return; }
  document.getElementById('rep-from').value = fmtDate(`${year}-01-01`);
  document.getElementById('rep-to').value   = fmtDate(`${year}-12-31`);
  renderReports();
}

function _updateDateInputPlaceholders() {
  const fmt = State.workspaceSettings?.date_format || 'YYYY-MM-DD';
  ['rep-from', 'rep-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.placeholder = fmt;
  });
}

function setReportPeriod(preset) {
  document.getElementById('rep-year').value = '';
  const yr = new Date().getFullYear();
  if (preset === 'ytd') {
    document.getElementById('rep-from').value = fmtDate(`${yr}-01-01`);
    document.getElementById('rep-to').value   = fmtDate(new Date().toISOString().slice(0, 10));
  } else if (preset === 'lastyear') {
    document.getElementById('rep-from').value = fmtDate(`${yr - 1}-01-01`);
    document.getElementById('rep-to').value   = fmtDate(`${yr - 1}-12-31`);
  } else {
    document.getElementById('rep-from').value = '';
    document.getElementById('rep-to').value   = '';
  }
  renderReports();
}

function renderReports() {
  if (!repIncomeTable) initReportTables();

  const propId     = document.getElementById('rep-apt')?.value  || 'all';
  const dateFrom   = parseDateToISO(document.getElementById('rep-from')?.value || '');
  const dateTo     = parseDateToISO(document.getElementById('rep-to')?.value   || '');

  _updateDateInputPlaceholders();
  const filtered     = Reports.filter(State.transactions, { property_id: propId, date_from: dateFrom, date_to: dateTo });
  const visibleProps = propId !== 'all'
    ? State.properties.filter(p => p.id === propId)
    : State.properties;
  const summary      = Reports.pnl(filtered, visibleProps);

  document.getElementById('rep-metrics').innerHTML = `
    <div class="metric"><div class="m-label">${t('reports.metrics.totalIncome')}</div><div class="m-value positive">${Reports.fmtDKK(summary.totals.income_dkk)}</div><div class="m-sub">${t('reports.metrics.dkkEquiv')}</div></div>
    <div class="metric"><div class="m-label">${t('reports.metrics.totalExpenses')}</div><div class="m-value negative">${Reports.fmtDKK(summary.totals.expenses_dkk)}</div><div class="m-sub">${t('reports.metrics.dkkEquiv')}</div></div>
    <div class="metric"><div class="m-label">${t('reports.metrics.net')}</div><div class="m-value ${summary.totals.net_dkk>=0?'positive':'negative'}">${Reports.fmtDKK(summary.totals.net_dkk)}</div><div class="m-sub">${t('reports.metrics.dkkEquiv')}</div></div>
    <div class="metric"><div class="m-label">${t('reports.metrics.transactions')}</div><div class="m-value">${filtered.length}</div><div class="m-sub">${t('reports.metrics.inPeriod')}</div></div>
  `;

  const cats  = Reports.categoryBreakdown(filtered);
  _repIncCats = cats.filter(c => c.type === 'income');
  _repExpCats = cats.filter(c => c.type === 'expense');
  _repPnlRows = Object.values(summary.byProperty);

  repIncomeTable.refresh();
  repExpenseTable.refresh();
  repPnlTable.refresh();
}

// ── Properties ────────────────────────────────────────────

async function onShowArchivedToggle(checked) {
  showArchivedProperties = checked;
  State.properties = await Api.getProperties({ includeArchived: showArchivedProperties });
  renderPropertyList();
}
window.onShowArchivedToggle = onShowArchivedToggle;

function renderPropertyList() {
  const list = document.getElementById('apt-list');
  if (!State.properties.length) {
    list.innerHTML = `<div class="empty-state"><strong>${t('property.noProperties')}</strong>${t('property.noPropertiesSub')}</div>`;
    return;
  }
  const sorted = [...State.properties].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  list.innerHTML = sorted.map(p => {
    const rent   = parseFloat(p.rent)   || 0;
    const aconto = parseFloat(p.aconto) || 0;
    const total  = rent + aconto;
    return `
    <div class="card" style="cursor:pointer${!p.active ? ';opacity:0.65' : ''}" onclick="openPropertyModal('${p.id}')">
      <div class="card-header">
        <div>
          <span class="badge badge-${p.country.toLowerCase()}">${t('country.' + p.country)} · ${p.currency}</span>
          <span class="badge badge-model" style="margin-left:6px">${t('property.model.' + (p.model || 'longterm'))}</span>
          ${!p.active ? `<span class="badge" style="margin-left:6px;background:#6c757d;color:#fff">${t('property.archivedBadge')}</span>` : ''}
          <div class="apt-name" style="margin-top:4px">${p.name}</div>
          <div style="font-size:12px;color:var(--text2)">${p.address}</div>
        </div>
        <div onclick="event.stopPropagation()">
          ${window.AUTH_TOKEN && p.active ? `<button class="btn btn-sm btn-secondary" onclick="archiveProperty('${p.id}')">${t('common.delete')}</button>` : ''}
        </div>
      </div>
      <div class="metric-grid" style="margin-top:1rem;margin-bottom:0">
        <div class="metric"><div class="m-label">${t('property.metric.rent')}</div><div class="m-value" style="font-size:16px">${rent   ? Reports.fmt(rent, p.currency) : '—'}</div></div>
        <div class="metric"><div class="m-label">${t('property.metric.aconto')}</div><div class="m-value" style="font-size:16px">${aconto ? Reports.fmt(aconto, p.currency) : '—'}</div></div>
        <div class="metric"><div class="m-label">${t('property.metric.totalMonthly')}</div><div class="m-value" style="font-size:16px">${total  ? Reports.fmt(total, p.currency) : '—'}</div></div>
        <div class="metric"><div class="m-label">${t('property.metric.tenant')}</div><div class="m-value" style="font-size:13px;margin-top:4px">${p.tenant || '—'}</div></div>
      </div>
    </div>
  `;
  }).join('');
}

function openPropertyModal(propId) {
  State.editingAptId = propId || null;
  populateAllDropdowns();
  if (propId) {
    const p = State.properties.find(x => x.id === propId);
    if (!p) return;
    document.getElementById('apt-modal-title').textContent  = t('property.modal.editTitle');
    document.getElementById('apt-m-name').value     = p.name;
    document.getElementById('apt-m-country').value  = p.country;
    document.getElementById('apt-m-addr').value     = p.address;
    document.getElementById('apt-m-currency').value = p.currency;
    document.getElementById('apt-m-model').value    = p.model || 'longterm';
    document.getElementById('apt-m-rent').value     = p.rent;
    document.getElementById('apt-m-aconto').value   = p.aconto;
    document.getElementById('apt-m-tenant').value   = p.tenant;
    document.getElementById('apt-m-lease').value    = p.lease_start;
    document.getElementById('apt-m-notes').value    = p.notes;
  } else {
    document.getElementById('apt-modal-title').textContent = t('property.modal.addTitle');
    ['apt-m-name','apt-m-addr','apt-m-currency','apt-m-rent','apt-m-aconto','apt-m-tenant','apt-m-lease','apt-m-notes']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('apt-m-country').value  = 'DK';
    document.getElementById('apt-m-currency').value = 'DKK';
  }
  document.getElementById('modal-apt').style.display = 'flex';
}

function onAptCountryChange() {
  const country = document.getElementById('apt-m-country').value;
  document.getElementById('apt-m-currency').value = country === 'DK' ? 'DKK' : country === 'PL' ? 'PLN' : '';
}

function closePropertyModal() { document.getElementById('modal-apt').style.display = 'none'; }

async function savePropertyModal() {
  const name = document.getElementById('apt-m-name').value.trim();
  if (!name) { toast(t('property.toast.nameReq'), 'error'); return; }
  const data = {
    name,
    address:     document.getElementById('apt-m-addr').value.trim(),
    country:     document.getElementById('apt-m-country').value,
    currency:    document.getElementById('apt-m-currency').value.trim().toUpperCase(),
    model:       document.getElementById('apt-m-model').value,
    rent:        parseFloat(document.getElementById('apt-m-rent').value)   || 0,
    aconto:      parseFloat(document.getElementById('apt-m-aconto').value) || 0,
    tenant:      document.getElementById('apt-m-tenant').value.trim(),
    lease_start: document.getElementById('apt-m-lease').value,
    notes:       document.getElementById('apt-m-notes').value.trim(),
    active:      true,
  };
  setLoading(true, t('status.saving'));
  try {
    // v2 mode: use backend API
    if (State.editingAptId) {
      await Api.updateProperty(State.editingAptId, data);
    } else {
      await Api.createProperty(data);
    }
    await refreshAll();
    closePropertyModal();
    toast(t('property.toast.saved'), 'success');
  } catch(e) {
    toast(t('property.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

async function archiveProperty(id) {
  if (!confirm(t('property.toast.archiveConfirm'))) return;
  setLoading(true, t('status.saving'));
  try {
    await Api.deleteProperty(id);
    await refreshAll();
    toast(t('property.toast.archived'), 'success');
  } catch(e) {
    toast(t('property.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

// ── Rules ─────────────────────────────────────────────────

let rulesTable = null;

function initRulesTable() {
  rulesTable = DataTable.create({
    containerId: 'rules-table-wrap',
    title: t('rules.title'),
    actions: [
      { label: t('rules.addBtn'), onclick: 'openRuleModal()' },
    ],
    columns: [
      { key: 'bank_profile', label: t('rules.col.bankProfile'), sortable: true },
      { key: 'keyword',      label: t('rules.col.keyword'),     sortable: true },
      { key: 'category',     label: t('rules.col.category'),    sortable: true },
      { key: 'property',     label: t('rules.col.property'),    sortable: true },
      { key: '_actions',     label: '',                         sortable: false, width: '4rem' },
    ],
    fetchData: async () => {
      return { data: State.rules, total: State.rules.length };
    },
    renderRow: (r) => {
      const prop    = State.properties.find(p => p.id === r.property_id);
      const profile = BANK_PROFILES[r.bank_profile]?.label || (r.bank_profile ? r.bank_profile : t('rules.modal.anyBank'));
      return `<tr>
        <td data-col="bank_profile" style="font-size:12px">${profile}</td>
        <td data-col="keyword"><code style="font-size:12px;background:var(--bg3);padding:2px 6px;border-radius:4px">${r.keyword}</code></td>
        <td data-col="category"><span class="tag tag-${Importer.categoryToType(r.category, State.transactionCategories)}">${catLabel(r.category)}</span></td>
        <td data-col="property" style="font-size:12px">${prop ? prop.name : '—'}</td>
        <td data-col="_actions"><button class="btn btn-sm btn-danger" onclick="deleteRule(${r.id})">✕</button></td>
      </tr>`;
    },
  });
}

async function deleteRule(id) {
  const idx = State.rules.findIndex(r => r.id === id);
  if (idx === -1) return;
  try {
    await Api.deleteRule(id);
    State.rules.splice(idx, 1);
    rulesTable.refresh();
    toast(t('rules.toast.saved'), 'success');
  } catch(e) {
    toast(t('rules.toast.saveFailed', { error: e.message }), 'error');
  }
}

function openRuleModal() {
  populateAllDropdowns();
  document.getElementById('rule-m-kw').value = '';
  document.getElementById('modal-rule').style.display = 'flex';
}

function closeRuleModal() { document.getElementById('modal-rule').style.display = 'none'; }

async function saveRuleModal() {
  const kw  = document.getElementById('rule-m-kw').value.trim().toLowerCase();
  const cat = document.getElementById('rule-m-cat').value;
  if (!kw || !cat) { toast(t('rules.toast.kwCatReq'), 'error'); return; }

  const ruleData = {
    bank_profile: document.getElementById('rule-m-profile').value,
    keyword:      kw,
    category:     cat,
    property_id:  document.getElementById('rule-m-apt').value || null,
  };

  // v2 mode: create via Api.createRule()
  try {
    const rule = await Api.createRule(ruleData);
    State.rules.push(rule);
    if (rulesTable) rulesTable.refresh();
    closeRuleModal();
    toast(t('rules.toast.saved'), 'success');
  } catch(e) {
    toast(t('rules.toast.saveFailed', { error: e.message }), 'error');
  }
}

async function saveRules() {
  setLoading(true, t('status.savingRules'));
  try {
    // v2 mode: update sort_order on each rule
    await Promise.all(State.rules.map((r, i) =>
      Api.updateRule(r.id, { sort_order: i })
    ));
    toast(t('rules.toast.saved'), 'success');
  } catch(e) {
    toast(t('rules.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

async function loadDefaultRules() {
  const defaults = [
    { bank_profile: 'jyske_bank', keyword: 'sabumba',      category: 'rent',               property_id: null },
    { bank_profile: 'jyske_bank', keyword: 'husleje',      category: 'rent',               property_id: null },
    { bank_profile: 'jyske_bank', keyword: 'varmebidrag',  category: 'heating_aconto',     property_id: null },
    { bank_profile: 'jyske_bank', keyword: 'vandafregn',   category: 'heating_settlement', property_id: null },
    { bank_profile: 'jyske_bank', keyword: 'ejendomsskat', category: 'property_tax',       property_id: null },
    { bank_profile: 'jyske_bank', keyword: 'forsikring',   category: 'insurance',          property_id: null },
    { bank_profile: 'mbank_pl',   keyword: 'czynsz',       category: 'rent',               property_id: null },
    { bank_profile: 'mbank_pl',   keyword: 'najem',        category: 'rent',               property_id: null },
    { bank_profile: '',           keyword: 'bank fee',     category: 'bank_charges',       property_id: null },
    { bank_profile: '',           keyword: 'gebyr',        category: 'bank_charges',       property_id: null },
  ];

  if (window.AUTH_TOKEN) {
    // v2 mode: create new defaults via Api
    const newDefaults = defaults.filter(d => !State.rules.some(r => r.keyword === d.keyword));
    try {
      for (const d of newDefaults) {
        const rule = await Api.createRule(d);
        State.rules.push(rule);
      }
      if (rulesTable) rulesTable.refresh();
      toast(t('rules.toast.defaultLoaded'), 'info');
    } catch(e) {
      toast(t('rules.toast.saveFailed', { error: e.message }), 'error');
    }
  } else {
    // v1 mode: in-memory only
    State.rules = [...State.rules, ...defaults.filter(d => !State.rules.some(r => r.keyword === d.keyword))];
    if (rulesTable) rulesTable.refresh();
    toast(t('rules.toast.defaultLoaded'), 'info');
  }
}

// ── Settings ──────────────────────────────────────────────

async function renderSettings() {
  const form = document.getElementById('settings-form');
  const loading = document.getElementById('settings-loading');

  try {
    loading.style.display = 'block';
    form.style.display = 'none';

    const settings = await Api.getWorkspaceSettings();
    document.getElementById('settings-currency').value   = settings.reporting_currency || 'USD';
    document.getElementById('settings-max-depth').value  = settings.max_account_depth  || 5;
    _setSelectValue(document.getElementById('settings-date-format'), settings.date_format || 'YYYY-MM-DD');

    loading.style.display = 'none';
    form.style.display = 'block';
  } catch(e) {
    loading.style.display = 'none';
    form.style.display = 'block';
    toast(t('settings.loadFailed', { error: e.message }), 'error');
  }

  renderCurrencyRates();
  renderTransactionCategories();
}

async function saveSettings(event) {
  event.preventDefault();

  const currency   = document.getElementById('settings-currency').value.trim().toUpperCase();
  const maxDepth   = parseInt(document.getElementById('settings-max-depth').value, 10);
  const dateFormat = document.getElementById('settings-date-format').value;

  if (!currency || isNaN(maxDepth) || maxDepth < 1) {
    toast(t('settings.validationError'), 'error');
    return;
  }

  try {
    const prev = State.workspaceSettings || {};
    await Api.updateWorkspaceSettings({
      reporting_currency: currency,
      max_account_depth:  maxDepth,
      date_format:        dateFormat,
    });
    if (State.workspaceSettings) {
      State.workspaceSettings.date_format        = dateFormat;
      State.workspaceSettings.reporting_currency = currency;
      State.workspaceSettings.max_account_depth  = maxDepth;
    }
    _updateDateInputPlaceholders();

    const diffs = [];
    if (prev.reporting_currency && prev.reporting_currency !== currency)
      diffs.push(`${t('settings.fieldCurrency')}: ${prev.reporting_currency} → ${currency}`);
    if (prev.max_account_depth != null && prev.max_account_depth !== maxDepth)
      diffs.push(`${t('settings.fieldMaxDepth')}: ${prev.max_account_depth} → ${maxDepth}`);
    if (prev.date_format && prev.date_format !== dateFormat)
      diffs.push(`${t('settings.fieldDateFormat')}: ${prev.date_format} → ${dateFormat}`);

    toast(diffs.length
      ? t('settings.savedChanged', { changes: diffs.join('; ') })
      : t('settings.savedSuccess'),
    'success');
  } catch(e) {
    toast(t('settings.saveFailed', { error: e.message }), 'error');
  }
}

// ── Currency Rates ────────────────────────────────────────

let _ratesCache = [];

async function renderCurrencyRates() {
  const loading = document.getElementById('rates-loading');
  const container = document.getElementById('rates-container');
  loading.style.display = 'block';
  container.innerHTML = '';

  try {
    _ratesCache = await Api.getCurrencyRates();
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = `<p style="padding:1rem;color:var(--danger)">Failed to load rates: ${e.message}</p>`;
    return;
  }

  loading.style.display = 'none';

  if (!_ratesCache.length) {
    container.innerHTML = '<p style="padding:1rem;color:var(--text-muted)">No rates defined yet. Add a rate to get started.</p>';
    return;
  }

  // Group by from→to pair
  const groups = {};
  for (const r of _ratesCache) {
    const key = `${r.from_currency}→${r.to_currency}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const html = Object.entries(groups).map(([pair, rates]) => `
    <div style="margin-bottom:1.5rem">
      <div style="font-weight:600;padding:0.5rem 0;border-bottom:1px solid var(--border)">${pair}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:0.4rem 0.5rem;font-size:12px;color:var(--text-muted)">Effective date</th>
          <th style="text-align:right;padding:0.4rem 0.5rem;font-size:12px;color:var(--text-muted)">Rate</th>
          <th style="text-align:center;padding:0.4rem 0.5rem;font-size:12px;color:var(--text-muted)">Source</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rates.map(r => `
            <tr>
              <td style="padding:0.4rem 0.5rem">${fmtDate(r.effective_date)}</td>
              <td style="padding:0.4rem 0.5rem;text-align:right">${parseFloat(r.rate).toFixed(6)}</td>
              <td style="padding:0.4rem 0.5rem;text-align:center"><span class="badge">${r.source}</span></td>
              <td style="padding:0.4rem 0.5rem;text-align:right">
                <button class="btn btn-danger btn-sm" onclick="deleteRate('${r.id}', '${pair}', '${r.effective_date}')">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');

  container.innerHTML = html;
}

function toggleAddRateForm() {
  const form = document.getElementById('add-rate-form');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) {
    document.getElementById('rate-from').value = '';
    document.getElementById('rate-to').value = '';
    document.getElementById('rate-date').value = '';
    document.getElementById('rate-value').value = '';
  }
}

async function submitAddRate() {
  const from_currency = document.getElementById('rate-from').value.trim().toUpperCase();
  const to_currency   = document.getElementById('rate-to').value.trim().toUpperCase();
  const effective_date = document.getElementById('rate-date').value;
  const rate = document.getElementById('rate-value').value;

  if (!from_currency || from_currency.length !== 3) { toast('From currency must be a 3-letter ISO code', 'error'); return; }
  if (!to_currency   || to_currency.length !== 3)   { toast('To currency must be a 3-letter ISO code', 'error'); return; }
  if (!effective_date) { toast('Effective date is required', 'error'); return; }
  if (!rate || parseFloat(rate) <= 0) { toast('Rate must be a positive number', 'error'); return; }

  try {
    await Api.createCurrencyRate({ from_currency, to_currency, effective_date, rate: parseFloat(rate) });
    toggleAddRateForm();
    await renderCurrencyRates();
    toast('Rate added', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function deleteRate(id, pair, date) {
  if (!confirm(`Delete rate for ${pair} on ${date}?`)) return;
  try {
    await Api.deleteCurrencyRate(id);
    await renderCurrencyRates();
    toast('Rate deleted', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ── Transaction Categories ─────────────────────────────────

const BUCKET_LABELS = { income: 'Income', expense: 'Expense', deposit: 'Deposit', transfer: 'Transfer' };

async function renderTransactionCategories() {
  const loading   = document.getElementById('categories-loading');
  const container = document.getElementById('categories-container');
  const addBtn    = document.getElementById('add-category-btn');
  loading.style.display = 'block';
  container.innerHTML = '';

  const isOwner = decodeToken(window.AUTH_TOKEN)?.role === 'owner';
  if (addBtn) addBtn.style.display = isOwner ? '' : 'none';

  let grouped;
  try {
    grouped = await Api.getTransactionCategoriesAll();
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = `<p style="padding:1rem;color:var(--danger)">Failed to load categories: ${e.message}</p>`;
    return;
  }
  loading.style.display = 'none';

  const buckets = Object.keys(grouped).sort();
  if (!buckets.length) {
    container.innerHTML = '<p style="padding:1rem;color:var(--text-muted)">No categories found.</p>';
    return;
  }

  const html = buckets.map(bucket => {
    const cats = grouped[bucket];
    const bucketLabel = BUCKET_LABELS[bucket] || bucket;
    const rows = cats.map(c => {
      const inactiveMark = !c.is_active
        ? '<span style="color:var(--text-muted);font-size:11px;margin-left:4px">(inactive)</span>'
        : '';
      const editBtn = isOwner
        ? `<button class="btn btn-secondary btn-sm" onclick="openEditCategoryForm('${c.id}','${escAttr(c.label)}','${escAttr(c.value)}')">Edit</button>`
        : '';
      const toggleBtn = isOwner
        ? `<button class="btn btn-secondary btn-sm" onclick="toggleCategoryActive('${c.id}',${!c.is_active})">${c.is_active ? 'Deactivate' : 'Activate'}</button>`
        : '';
      const deleteBtn = (!c.is_builtin && isOwner)
        ? `<button class="btn btn-danger btn-sm" onclick="deleteCategoryItem('${c.id}','${escAttr(c.label)}')">Delete</button>`
        : '';
      return `
        <tr style="${!c.is_active ? 'opacity:0.55' : ''}">
          <td style="padding:0.4rem 0.5rem">
            <span>${escHtml(c.label)}</span>${inactiveMark}
            <span style="color:var(--text-muted);font-size:11px;margin-left:6px">${escHtml(c.value)}</span>
            ${c.is_builtin ? '<span title="Built-in" style="color:var(--text-muted);font-size:11px;margin-left:4px">🔒</span>' : ''}
          </td>
          <td style="padding:0.4rem 0.5rem;text-align:right;white-space:nowrap">
            ${editBtn} ${toggleBtn} ${deleteBtn}
          </td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:1.5rem">
        <div style="font-weight:600;padding:0.5rem 0;border-bottom:1px solid var(--border)">${bucketLabel}</div>
        <table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

function toggleAddCategoryForm() {
  const form = document.getElementById('add-category-form');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) {
    document.getElementById('cat-bucket').value  = 'income';
    document.getElementById('cat-label').value   = '';
    document.getElementById('cat-value').value   = '';
  }
}

function onCatLabelBlur() {
  const label  = document.getElementById('cat-label').value.trim();
  const codeEl = document.getElementById('cat-value');
  if (!label || codeEl.value.trim()) return;
  const slug   = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suffix = Math.random().toString(36).slice(2, 5);
  codeEl.value = `${slug}_${suffix}`;
}

async function submitAddCategory() {
  const type_bucket = document.getElementById('cat-bucket').value;
  const label       = document.getElementById('cat-label').value.trim();
  const value       = document.getElementById('cat-value').value.trim().toLowerCase();

  if (!label) { toast('Label is required', 'error'); return; }
  if (!value) { toast('Code is required', 'error'); return; }

  try {
    await Api.createTransactionCategory({ type_bucket, value, label });
    toggleAddCategoryForm();
    await renderTransactionCategories();
    State.transactionCategories = await Api.getTransactionCategories();
    toast('Category added', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

function openNewCategoryModal(rowIdx) {
  const modal = document.getElementById('modal-new-cat');
  modal.dataset.rowIndex = rowIdx;
  document.getElementById('new-cat-bucket').value = 'expense';
  document.getElementById('new-cat-label').value  = '';
  document.getElementById('new-cat-value').value  = '';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('new-cat-label').focus(), 50);
}

function closeNewCategoryModal() {
  document.getElementById('modal-new-cat').style.display = 'none';
}

function _newCatCodeAutoFill() {
  const label  = document.getElementById('new-cat-label').value.trim();
  const codeEl = document.getElementById('new-cat-value');
  if (!label || codeEl.value.trim()) return;
  const slug   = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suffix = Math.random().toString(36).slice(2, 5);
  codeEl.value = `${slug}_${suffix}`;
}

async function submitNewCategoryFromImport() {
  const type_bucket = document.getElementById('new-cat-bucket').value;
  const label       = document.getElementById('new-cat-label').value.trim();
  const value       = document.getElementById('new-cat-value').value.trim().toLowerCase();

  if (!label) { toast('Label is required', 'error'); return; }
  if (!value) { toast('Code is required', 'error'); return; }

  const modal  = document.getElementById('modal-new-cat');
  const rowIdx = parseInt(modal.dataset.rowIndex, 10);

  try {
    await Api.createTransactionCategory({ type_bucket, value, label });
    modal.style.display = 'none';
    State.transactionCategories = await Api.getTransactionCategories();
    onRowFieldChange(rowIdx, 'category', value);
    renderImportTable();
    toast('Category added', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

function openEditCategoryForm(id, currentLabel, code) {
  document.getElementById('edit-cat-id').value      = id;
  document.getElementById('edit-cat-label').value   = currentLabel;
  document.getElementById('edit-cat-code').value    = code;
  document.getElementById('edit-category-form').style.display = 'block';
}

function closeEditCategoryForm() {
  document.getElementById('edit-category-form').style.display = 'none';
}

async function submitEditCategory() {
  const id    = document.getElementById('edit-cat-id').value;
  const label = document.getElementById('edit-cat-label').value.trim();
  if (!label) { toast('Label cannot be empty', 'error'); return; }
  try {
    await Api.updateTransactionCategory(id, { label });
    closeEditCategoryForm();
    await renderTransactionCategories();
    State.transactionCategories = await Api.getTransactionCategories();
    toast('Category updated', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function toggleCategoryActive(id, newActive) {
  try {
    await Api.updateTransactionCategory(id, { is_active: newActive });
    await renderTransactionCategories();
    State.transactionCategories = await Api.getTransactionCategories();
    toast(newActive ? 'Category activated' : 'Category deactivated', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function deleteCategoryItem(id, label) {
  if (!confirm(`Delete category '${label}'?`)) return;
  try {
    await Api.deleteTransactionCategory(id);
    await renderTransactionCategories();
    State.transactionCategories = await Api.getTransactionCategories();
    toast('Category deleted', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ── Toasts ────────────────────────────────────────────────

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Loading ───────────────────────────────────────────────

function setLoading(on, msg) {
  const el = document.getElementById('loading');
  if (on) { document.getElementById('loading-msg').textContent = msg || t('common.loading'); el.classList.remove('hidden'); }
  else    { el.classList.add('hidden'); }
}

function setStatus(msg) {
  const syncInfo = document.getElementById('sync-info');
  if (syncInfo) {
    syncInfo.textContent = msg;
  }
}

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);

// Expose to inline HTML handlers
Object.assign(window, {
  showPage, refreshAll,
  openTxModal, closeTxModal, saveTxModal, deleteTxModal, onCategoryChange,
  deleteTxWithConfirm,
  onProfileChange, onImportFileChange, onImportDragOver, onImportDragLeave, onImportDrop,
  toggleImportPaste, clearImport, runImportPreview, renderImportTable, toggleImportSection, _updatePreviewBtnState,
  toggleSelectAll, onRowSelect, onRowFieldChange, onImportLockBtnClick, sortImportCol,
  refreshSavedMappingsDropdown, loadSavedMapping, saveCurrentMapping, deleteSavedMapping,
  goToStaticPreview, backToEditPreview, goToMappingConfirmOrImport, backToStaticPreview,
  toggleTree, doImport,
  toggleImportHistory, undoImportBatch, closeUndoModal, confirmUndoImport,
  onDateFilterInput,
  setReportYear, setReportPeriod, renderReports,
  openPropertyModal, closePropertyModal, savePropertyModal, onAptCountryChange, archiveProperty,
  openRuleModal, closeRuleModal, saveRuleModal, saveRules, loadDefaultRules, deleteRule,
  saveSettings, toggleAddRateForm, submitAddRate, deleteRate,
  toggleAddCategoryForm, submitAddCategory, deleteCategoryItem,
  onCatLabelBlur, toggleCategoryActive,
  openEditCategoryForm, submitEditCategory, closeEditCategoryForm,
  openNewCategoryModal, closeNewCategoryModal, _newCatCodeAutoFill, submitNewCategoryFromImport,
});
