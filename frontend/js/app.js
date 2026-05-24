// ============================================================
//  APP — main UI controller
// ============================================================

import { CONFIG, CATEGORIES, BANK_PROFILES } from '../config.js';
import { t, countryDisplayName, ISO_COUNTRY_CODES, COUNTRY_CURRENCIES } from './strings.js';
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
  splitRules:           [],
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
  if (row._autoSplit)          return `<span class="tag tag-split" title="${escHtml(row._autoSplitRuleName || 'Split rule')}">Auto-split</span> `;
  if (row._descMappingMatched) return '<span class="tag tag-mapping">mapped</span> ';
  if (row._autoMatched)        return '<span class="tag tag-auto">auto</span> ';
  return '';
}

// Evaluates enabled split rules against each row (client-side mirror of server logic for preview).
function _markAutoSplitRows(rows) {
  const rules = (State.splitRules || []).filter(r => r.enabled);
  rows.forEach(row => {
    const match = rules.find(rule => rule.conditions.every(c => {
      const field = c.field;
      const op    = c.operator;
      const val   = c.value;
      if (op === 'in') {
        const ids    = Array.isArray(val) ? val : [];
        if (ids.length === 0) return true;
        const rowVal = field === 'property_id' ? row.property_id : row.account_id;
        return ids.includes(rowVal);
      }
      if (field === 'amount') {
        const amt = parseFloat(row.amount);
        const cmp = parseFloat(val);
        if (op === 'equals')       return amt === cmp;
        if (op === 'greater_than') return amt > cmp;
        if (op === 'less_than')    return amt < cmp;
      }
      if (field === 'description') {
        const desc = (row.description || '').toLowerCase();
        if (op === 'contains') return desc.includes(String(val).toLowerCase());
        if (op === 'equals')   return desc === String(val).toLowerCase();
      }
      return false;
    }));
    row._autoSplit         = !!match;
    row._autoSplitRuleName = match ? match.name : null;
  });
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
    const [props, txs, rules, splitRules, descMappings, wsSettings, rates, txCategories] = await Promise.all([
      Api.getProperties(),
      Api.getTransactions({ limit: 10000 }),
      Api.getRules(),
      Api.getSplitRules(),
      Api.getDescMappings(),
      Api.getWorkspaceSettings(),
      Api.getCurrencyRates(),
      Api.getTransactionCategories(),
    ]);
    State.properties             = props;
    State.transactions           = (txs.data ?? txs).map(tx => ({ ...tx, amount: parseFloat(tx.amount) }));
    State.rules                  = rules;
    State.splitRules             = splitRules;
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
  if (currentPage === 'accounts')     renderAccounts();
  if (currentPage === 'rules')        { if (!rulesTable) initRulesTable(); else rulesTable.refresh(); renderSplitRulesList(); }
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
    const saved = el.value;
    let blank;
    if (id === 'rule-m-apt')  blank = `<option value="">${t('rules.modal.anyProperty')}</option>`;
    else if (id === 'import-apt') blank = `<option value="">${t('import.autoDetect')}</option>`;
    else                      blank = `<option value="">${t('common.select')}</option>`;
    el.innerHTML = blank + propOpts;
    if (saved) el.value = saved;
  });

  const catOpts = Importer.buildCategoryOptions('');
  ['tx-m-cat','rule-m-cat'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = el.value;
    el.innerHTML = `<option value="">${t('common.select')}</option>` + catOpts;
    if (saved) el.value = saved;
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
      <div class="m-sub">${(() => {
        const active = props.filter(p => p.active);
        const counts = {};
        active.forEach(p => { if (p.country) counts[p.country] = (counts[p.country] || 0) + 1; });
        const parts = Object.keys(counts).sort((a, b) => countryDisplayName(a).localeCompare(countryDisplayName(b)))
          .map(c => `${counts[c]} ${countryDisplayName(c)}`);
        return parts.join(' · ');
      })()}</div>
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
let _splitExpanded = {};

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
      {
        label:     t('tx.split.collapseAll'),
        onclick:   'toggleAllSplits()',
        id:        'tx-split-toggle-all-btn',
        className: 'btn btn-sm btn-secondary',
      },
    ],
    columns: [
      { key: '_chevron', label: '', sortable: false, defaultVisible: true, width: '2rem' },
      {
        key: 'property', label: t('tx.col.property'), sortable: true, defaultVisible: true,
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
        key: 'type', label: t('tx.col.type'), sortable: true, defaultVisible: true, width: '6rem',
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
        key: 'category', label: t('tx.col.category'), sortable: true, defaultVisible: true, width: '9rem',
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
        key: 'description', label: t('tx.col.description'), sortable: true, defaultVisible: true,
        filter: { type: 'text', placeholder: t('common.search') },
      },
      { key: 'source',   label: t('tx.col.source'), sortable: true,  defaultVisible: true },
      { key: 'amount',   label: t('tx.col.amount'), sortable: true,  defaultVisible: true, align: 'right' },
      {
        key: 'reconciled', label: t('tx.col.reconciled'), sortable: false, defaultVisible: true,
        filter: { type: 'toggle', placeholder: t('tx.filter.unreconciled') },
        width: '6rem',
      },
      { key: '_actions', label: '', sortable: false, defaultVisible: true, width: '5rem' },
    ],
    fetchData: async (params) => {
      const filters = { page: params.page, limit: params.limit, exclude_children: 1 };
      if (params.sort_col) { filters.sort_col = params.sort_col; filters.sort_dir = params.sort_dir; }
      if (params.property)   filters.property_id = params.property;
      if (params.type)       filters.type        = params.type;
      if (params.category)   filters.category    = params.category;
      const dateFrom = parseDateToISO(params['date-from'] || '');
      const dateTo   = parseDateToISO(params['date-to']   || '');
      if (dateFrom) filters.from = dateFrom;
      if (dateTo)   filters.to   = dateTo;
      if (params.description) filters.search     = params.description;
      if (params.reconciled)  filters.reconciled = 'false';
      const result = await Api.getTransactions(filters);
      const rows = (result.data ?? []).map(tx => ({ ...tx, amount: parseFloat(tx.amount) }));

      const splitParents = rows.filter(tx => (tx.split_count || 0) > 0);
      if (splitParents.length === 0) return { data: rows, total: result.total ?? 0 };

      const childResults = await Promise.all(
        splitParents.map(p => Api.getSplits(p.id).catch(() => []))
      );
      const childMap = {};
      splitParents.forEach((p, i) => {
        childMap[p.id] = (childResults[i] || []).map(c => ({ ...c, amount: parseFloat(c.amount) }));
      });

      const grouped = [];
      for (const tx of rows) {
        grouped.push(tx);
        if (childMap[tx.id]) grouped.push(...childMap[tx.id]);
      }
      return { data: grouped, total: result.total ?? 0 };
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
    postRender: (data) => {
      const hasSplits = data.some(tx => (tx.split_count || 0) > 0);

      const hdr = document.querySelector('#tx-table-wrap-col-hdr [data-sort-key="_chevron"]');
      if (hdr) hdr.classList.toggle('dt-col-zero', !hasSplits);
      document.querySelectorAll('#tx-table-wrap-body [data-col="_chevron"]').forEach(el => {
        el.classList.toggle('dt-col-zero', !hasSplits);
      });
      document.querySelectorAll('#tx-table-wrap [data-col-key="_chevron"]').forEach(col => {
        col.style.width    = hasSplits ? '2rem' : '0';
        col.style.minWidth = hasSplits ? '' : '0';
      });

      const toggleBtn = document.getElementById('tx-split-toggle-all-btn');
      if (toggleBtn) toggleBtn.style.display = hasSplits ? '' : 'none';

      if (!hasSplits) return;

      data.filter(tx => tx.parent_transaction_id).forEach(child => {
        const expanded = _splitExpanded[child.parent_transaction_id] !== false;
        document.querySelectorAll(`#tx-table-wrap-body tr[data-parent-id="${child.parent_transaction_id}"]`)
          .forEach(tr => { tr.style.display = expanded ? '' : 'none'; });
      });

      data.filter(tx => (tx.split_count || 0) > 0).forEach(parent => {
        _updateChevron(parent.id, _splitExpanded[parent.id] !== false);
      });

      _updateToggleAllBtn();
    },
  });
}

function dashTxRow(tx) {
  const prop   = State.properties.find(p => p.id === tx.property_id);
  const catLbl = catLabel(tx.category);
  const amtCls = tx.type === 'income' ? 'positive' : tx.type === 'expense' ? 'negative' : '';
  const currency = tx.currency || prop?.currency || '';
  let desc = tx.description;
  if (!desc && tx.parent_transaction_id) {
    const parent = State.transactions.find(p => p.id === tx.parent_transaction_id);
    desc = parent?.description ? `${parent.description} (Split)` : '(Split)';
  }
  return `<tr class="clickable-row" onclick="openTxModal('${tx.id}')">
    <td>${fmtDate(tx.date)}</td>
    <td>${prop ? prop.name : '<span class="muted">—</span>'}</td>
    <td>${desc || ''}</td>
    <td><span class="tag tag-${tx.type}">${catLbl}</span></td>
    <td class="amount-cell ${amtCls}">${Reports.fmt(tx.amount, currency)}<span class="muted" style="font-size:11px;margin-left:4px">${currency}</span></td>
  </tr>`;
}

function txRow(tx) {
  const prop   = State.properties.find(p => p.id === tx.property_id);
  const catLbl = catLabel(tx.category);
  const srcLbl = tx.source === 'manual' ? t('common.manual') : (BANK_PROFILES[tx.source]?.label || tx.source);
  const currency = tx.currency || prop?.currency || '';

  const isSplitParent = (tx.split_count || 0) > 0;
  const isChild       = !!tx.parent_transaction_id;
  const amtCls = isSplitParent ? 'muted' : (tx.type === 'income' ? 'positive' : tx.type === 'expense' ? 'negative' : '');

  const reportingCurrency = State.workspaceSettings?.reporting_currency;
  let convertedHtml = '';
  if (!isSplitParent && reportingCurrency && currency !== reportingCurrency) {
    const rates = State.currencyRates || [];
    const rate = rates
      .filter(r => r.from_currency === currency && r.to_currency === reportingCurrency && r.effective_date <= tx.date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
    if (rate) {
      const converted = (tx.amount * parseFloat(rate.rate)).toFixed(2);
      convertedHtml = `<div style="font-size:11px;color:var(--text3)">${Reports.fmt(converted, reportingCurrency)}</div>`;
    }
  }

  const descPrefix  = isChild ? '<span class="tx-child-prefix">↳</span> ' : '';
  const splitBadge  = isSplitParent ? ' <span class="tag tag-split">Split</span>' : '';

  const recBtn = `<button class="btn-reconcile${tx.reconciled ? ' is-reconciled' : ''}" title="${tx.reconciled ? t('tx.unreconcileBtnTitle') : t('tx.reconcileBtnTitle')}" onclick="event.stopPropagation();toggleReconciled('${tx.id}',${!!tx.reconciled})">${tx.reconciled ? t('tx.reconcileBtn') : t('tx.unreconcileBtn')}</button>`;
  const deleteBtn = window.AUTH_TOKEN
    ? `<button class="btn btn-sm btn-secondary" style="margin-left:6px" onclick="event.stopPropagation();deleteTxWithConfirm('${tx.id}')">${t('common.delete')}</button>`
    : '';
  const recClass  = tx.reconciled ? ' tx-reconciled' : '';
  const rowAttrs  = isSplitParent ? ` data-split-parent="${tx.id}"` : isChild ? ` data-parent-id="${tx.parent_transaction_id}"` : '';
  const rowClass  = `clickable-row${recClass}${isChild ? ' tx-split-child' : ''}`;

  const chevronCell = isSplitParent
    ? `<td data-col="_chevron" onclick="event.stopPropagation()"><button class="tx-chevron-btn" onclick="toggleSplitRows('${tx.id}')">▼</button></td>`
    : `<td data-col="_chevron"></td>`;
  const checkboxCell = isChild
    ? `<td></td>`
    : `<td onclick="event.stopPropagation()"><input type="checkbox" data-row-id="${tx.id}"></td>`;
  const propCell = isChild
    ? `<td data-col="property"></td>`
    : `<td data-col="property">${prop ? prop.name : '<span class="muted">—</span>'}</td>`;
  const dateCell = isChild
    ? `<td data-col="date"></td>`
    : `<td data-col="date">${fmtDate(tx.date)}</td>`;

  return `<tr class="${rowClass}"${rowAttrs} onclick="openTxModal('${tx.id}')">
    ${checkboxCell}
    ${chevronCell}
    ${propCell}
    ${dateCell}
    <td data-col="type"><span class="tag tag-${tx.type}">${t('categories.' + tx.type)}</span></td>
    <td data-col="category"><span class="tag tag-${tx.type}${catLbl.length > 20 ? ' tag-wrap' : ''}">${catLbl}</span></td>
    <td data-col="description">${descPrefix}${tx.description || ''}${splitBadge}${tx.notes ? `<div style="font-size:11px;color:var(--text3)">${tx.notes}</div>` : ''}</td>
    <td data-col="source"><span class="muted" style="font-size:11px">${srcLbl}</span></td>
    <td data-col="amount" class="amount-cell ${amtCls}">${Reports.fmt(tx.amount, currency)}<span class="muted" style="font-size:11px;margin-left:4px">${currency}</span>${convertedHtml}</td>
    <td data-col="reconciled" style="text-align:center">${recBtn}</td>
    <td data-col="_actions"><div style="display:flex">${deleteBtn}</div></td>
  </tr>`;
}

async function toggleReconciled(txId, current) {
  try {
    const newVal = !current;
    await Api.updateTransaction(txId, { reconciled: newVal });

    // Update State so dashboard metrics stay correct
    const tx = State.transactions.find(t => t.id === txId);
    if (tx) tx.reconciled = newVal;

    // Patch the DOM row in-place — avoids triggering a re-sort
    const cb  = document.querySelector(`[data-row-id="${txId}"]`);
    const row = cb?.closest('tr');
    if (row) {
      row.classList.toggle('tx-reconciled', newVal);
      const btn = row.querySelector('.btn-reconcile');
      if (btn) {
        btn.classList.toggle('is-reconciled', newVal);
        btn.title       = newVal ? t('tx.unreconcileBtnTitle') : t('tx.reconcileBtnTitle');
        btn.textContent = newVal ? t('tx.reconcileBtn') : t('tx.unreconcileBtn');
        btn.setAttribute('onclick', `event.stopPropagation();toggleReconciled('${txId}',${newVal})`);
      }
    }
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
  closeSplitEditor();
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

  // Auto-open the split editor if this transaction already has children
  if (txId) {
    const tx = State.transactions.find(t => t.id === txId);
    if (tx && (tx.split_count || 0) > 0) openSplitEditor();
  }
}

function closeTxModal() {
  document.getElementById('modal-tx').style.display = 'none';
  const postActions = document.getElementById('tx-m-post-split-actions');
  if (postActions) postActions.style.display = 'none';
  State._lastSavedSplitRows = null;
  State._lastSavedSplitTxId = null;
  closeSplitEditor();
}

// ── Split editor ──────────────────────────────────────────
let _splitEditorActive = false;

function _fmtSplitAmt(n) {
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

async function openSplitEditor() {
  const tx = State.transactions.find(t => t.id === State.editingTxId);
  if (!tx) return;

  _splitEditorActive = true;
  document.getElementById('tx-m-split-section').style.display = 'block';
  document.getElementById('tx-m-split-btn').style.display     = 'none';

  const totalInfo = document.getElementById('tx-m-split-total-info');
  totalInfo.textContent = t('tx.split.total', { amount: _fmtSplitAmt(tx.amount), currency: tx.currency });

  const tbody = document.getElementById('tx-m-split-tbody');
  tbody.innerHTML = '';

  if ((tx.split_count || 0) > 0) {
    // Load existing children
    document.getElementById('tx-m-remove-splits-btn').style.display = 'inline-block';
    try {
      const children = await Api.getSplits(tx.id);
      for (const child of children) {
        _addSplitRowEl(child.type, child.category, child.description || '', child.amount);
      }
    } catch (e) {
      // Fallback: 2 blank rows
      _addSplitRowEl(tx.type, tx.category, '', '');
      _addSplitRowEl(tx.type, tx.category, '', '');
    }
  } else {
    document.getElementById('tx-m-remove-splits-btn').style.display = 'none';
    _addSplitRowEl(tx.type, tx.category, '', '');
    _addSplitRowEl(tx.type, tx.category, '', '');
  }

  _updateSplitRemaining();
}

function closeSplitEditor() {
  _splitEditorActive = false;
  const section = document.getElementById('tx-m-split-section');
  if (section) section.style.display = 'none';
  const splitBtn = document.getElementById('tx-m-split-btn');
  if (splitBtn) {
    if (State.editingTxId) {
      const tx = State.transactions.find(t => t.id === State.editingTxId);
      splitBtn.style.display = (tx && !tx.parent_transaction_id) ? 'inline-block' : 'none';
    } else {
      splitBtn.style.display = 'none';
    }
  }
  _updateSaveBtnState();
}

function addSplitRow() {
  _addSplitRowEl('income', '', '', '');
  _updateSplitRemaining();
}

function _addSplitRowEl(type, category, description, amount) {
  const tbody = document.getElementById('tx-m-split-tbody');
  const idx   = tbody.querySelectorAll('tr').length;
  const tr    = document.createElement('tr');

  const typeOpts = ['income','expense','deposit','transfer']
    .map(v => `<option value="${v}" ${v === type ? 'selected' : ''}>${t('categories.' + v)}</option>`)
    .join('');

  tr.innerHTML = `
    <td style="padding:3px"><select class="split-row-type" onchange="_onSplitTypeChange(this)">${typeOpts}</select></td>
    <td style="padding:3px"><select class="split-row-cat" onchange="_updateSplitRemaining()"></select></td>
    <td style="padding:3px"><input type="text" class="split-row-desc" value="${_esc(description)}" style="width:100%"></td>
    <td style="padding:3px"><input type="number" class="split-row-amt" min="0.01" step="0.01" value="${amount || ''}" oninput="_updateSplitRemaining()" style="width:80px;text-align:right"></td>
    <td style="padding:3px;text-align:center">
      <button class="btn btn-sm" style="padding:2px 6px;font-size:11px" onclick="_removeSplitRow(this)">✕</button>
      <button class="btn btn-sm btn-secondary split-fill-btn" style="padding:2px 6px;font-size:11px;display:none" onclick="_fillSplitRemaining(this)" title="${t('tx.split.fillRemaining')}">→</button>
    </td>`;

  tbody.appendChild(tr);
  _populateSplitCatSelect(tr.querySelector('.split-row-cat'), type, category);
  _updateFillButtons();
}

function _populateSplitCatSelect(sel, type, selectedCat) {
  sel.innerHTML = '<option value="">—</option>';
  const cats = (State.transactionCategories[type] || []).filter(c => c.is_active);
  for (const c of cats) {
    const opt = document.createElement('option');
    opt.value = c.value;
    opt.textContent = catLabel(c.value);
    if (c.value === selectedCat) opt.selected = true;
    sel.appendChild(opt);
  }
}

function _onSplitTypeChange(sel) {
  const row = sel.closest('tr');
  const catSel = row.querySelector('.split-row-cat');
  _populateSplitCatSelect(catSel, sel.value, '');
  _updateSplitRemaining();
}

function _removeSplitRow(btn) {
  btn.closest('tr').remove();
  _updateSplitRemaining();
  _updateFillButtons();
}

function _updateFillButtons() {
  const rows = document.querySelectorAll('#tx-m-split-tbody tr');
  rows.forEach((row, i) => {
    const fillBtn = row.querySelector('.split-fill-btn');
    if (fillBtn) fillBtn.style.display = (i === rows.length - 1) ? 'inline-block' : 'none';
  });
}

function _fillSplitRemaining(btn) {
  const tx = State.transactions.find(t => t.id === State.editingTxId);
  if (!tx) return;
  const total  = parseFloat(tx.amount);
  const rows   = document.querySelectorAll('#tx-m-split-tbody tr');
  let sum = 0;
  rows.forEach((row, i) => {
    if (i < rows.length - 1) sum += parseFloat(row.querySelector('.split-row-amt').value) || 0;
  });
  const remaining = Math.max(0, parseFloat((total - sum).toFixed(6)));
  btn.closest('tr').querySelector('.split-row-amt').value = remaining;
  _updateSplitRemaining();
}

function _updateSplitRemaining() {
  const tx = State.editingTxId ? State.transactions.find(t => t.id === State.editingTxId) : null;
  if (!tx) return;

  const total   = parseFloat(tx.amount);
  const rows    = document.querySelectorAll('#tx-m-split-tbody tr');
  let sum = 0;
  rows.forEach(row => { sum += parseFloat(row.querySelector('.split-row-amt')?.value) || 0; });
  sum = parseFloat(sum.toFixed(6));

  const remaining = parseFloat((total - sum).toFixed(6));
  const el = document.getElementById('tx-m-split-remaining');
  if (el) {
    const currency = tx.currency || '';
    if (Math.abs(remaining) < 0.0000005) {
      el.innerHTML = `<span style="color:var(--success)">✓ ${t('tx.split.balanced')}</span>`;
    } else {
      el.innerHTML = `<span style="color:var(--red)">${t('tx.split.remaining')}: ${_fmtSplitAmt(remaining)} ${currency}</span>`;
    }
  }
  _updateSaveBtnState();
  _updateFillButtons();
}

function _updateSaveBtnState() {
  const saveBtn = document.getElementById('tx-m-save-btn');
  if (!saveBtn) return;

  if (!_splitEditorActive) {
    saveBtn.disabled = false;
    saveBtn.title = '';
    return;
  }

  const tx = State.editingTxId ? State.transactions.find(t => t.id === State.editingTxId) : null;
  if (!tx) return;

  const total = parseFloat(tx.amount);
  const rows  = document.querySelectorAll('#tx-m-split-tbody tr');
  if (rows.length < 2) { saveBtn.disabled = true; saveBtn.title = t('tx.split.minRows'); return; }

  let sum = 0;
  rows.forEach(row => { sum += parseFloat(row.querySelector('.split-row-amt')?.value) || 0; });
  sum = parseFloat(sum.toFixed(6));

  const balanced = Math.abs(total - sum) < 0.0000005;
  saveBtn.disabled = !balanced;
  saveBtn.title    = balanced ? '' : t('tx.split.saveDisabledHint');
}

function toggleSplitRows(parentId) {
  const newExpanded = _splitExpanded[parentId] === false;
  _splitExpanded[parentId] = newExpanded;
  document.querySelectorAll(`#tx-table-wrap-body tr[data-parent-id="${parentId}"]`)
    .forEach(tr => { tr.style.display = newExpanded ? '' : 'none'; });
  _updateChevron(parentId, newExpanded);
  _updateToggleAllBtn();
}

function toggleAllSplits() {
  const children = [...document.querySelectorAll('#tx-table-wrap-body tr[data-parent-id]')];
  const anyExpanded = children.some(tr => tr.style.display !== 'none');
  const expand = !anyExpanded;
  children.forEach(tr => {
    tr.style.display = expand ? '' : 'none';
    _splitExpanded[tr.dataset.parentId] = expand;
  });
  document.querySelectorAll('#tx-table-wrap-body tr[data-split-parent]')
    .forEach(tr => _updateChevron(tr.dataset.splitParent, expand));
  _updateToggleAllBtn();
}

function _updateChevron(parentId, expanded) {
  const btn = document.querySelector(`#tx-table-wrap-body tr[data-split-parent="${parentId}"] .tx-chevron-btn`);
  if (btn) btn.textContent = expanded ? '▼' : '▶';
}

function _updateToggleAllBtn() {
  const btn = document.getElementById('tx-split-toggle-all-btn');
  if (!btn) return;
  const anyExpanded = [...document.querySelectorAll('#tx-table-wrap-body tr[data-parent-id]')]
    .some(tr => tr.style.display !== 'none');
  btn.textContent = anyExpanded ? t('tx.split.collapseAll') : t('tx.split.expandAll');
}

async function removeSplitsConfirm() {
  setLoading(true, t('status.saving'));
  try {
    await Api.removeSplits(State.editingTxId);
    await refreshAll();
    closeTxModal();
    toast(t('tx.split.removed'), 'success');
  } catch(e) {
    toast(t('tx.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
}

function _esc(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
      if (_splitEditorActive) {
        const splitRows = [...document.querySelectorAll('#tx-m-split-tbody tr')].map(row => ({
          type:        row.querySelector('.split-row-type').value,
          category:    row.querySelector('.split-row-cat').value || null,
          description: row.querySelector('.split-row-desc').value.trim(),
          amount:      parseFloat(row.querySelector('.split-row-amt').value),
        }));
        await Api.saveSplits(State.editingTxId, splitRows);
        State._lastSavedSplitRows = splitRows;
        State._lastSavedSplitTxId = State.editingTxId;
        toast(t('tx.split.saved'), 'success');
        await refreshAll();
        // Show post-split secondary actions without closing the modal
        const postActions = document.getElementById('tx-m-post-split-actions');
        if (postActions) postActions.style.display = 'block';
        closeSplitEditor();
        return;
      } else {
        toast(t('tx.toast.updated'), 'success');
      }
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

  const warnResolved = row._isDuplicate || row._ignored || row._autoMatched || row._descMappingMatched || row._userPickedCategory;
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
    <td style="text-align:right;padding-right:4px;white-space:nowrap"><span id="row-tags-${i}">${_buildMatchTag(row)}</span></td>
    <td style="text-align:center"><input type="checkbox" id="row-sel-${i}" onchange="onRowSelect(${i})"${row._selected ? ' checked' : ''}></td>
    <td>${fmtDate(row.date)}</td>
    <td style="max-width:160px;font-size:12px">${row.description}</td>
    <td><select id="row-prop-${i}" style="font-size:12px;padding:4px 6px" onchange="onRowFieldChange(${i},'property_id',this.value)"${dis}><option value="">—</option>${propOpts}</select></td>
    <td><select id="row-cat-${i}" style="font-size:12px;padding:4px 6px" onchange="onRowFieldChange(${i},'category',this.value)"${dis}>${catOpts}</select></td>
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
      html += `<tr class="import-section-hdr"><td colspan="10"><span class="chevron">▼</span> ${t('import.sections.selected')} (${sel.length})</td></tr>`;
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
      html += `<tr class="import-section-hdr" onclick="toggleImportSection(${sec.id})"><td colspan="10"><span class="chevron">${chevron}</span> ${t('import.sections.' + sec.key)} (${rows.length})</td></tr>`;
      if (!collapsed) rows.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
    }
  } else {
    rest.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
  }

  // Locked ("Finished") section always at the very bottom
  if (lockedItems.length) {
    const collapsed = _groupCollapsed[6];
    const chevron   = collapsed ? '▶' : '▼';
    html += `<tr class="import-section-hdr" onclick="toggleImportSection(6)"><td colspan="10"><span class="chevron">${chevron}</span> ${t('import.sections.locked')} (${lockedItems.length})</td></tr>`;
    if (!collapsed) lockedItems.forEach(({ row, i }) => { html += _buildRowHtml(row, i); });
  }

  tbody.innerHTML = html;

  // keep sticky section-header rows below the sticky thead
  const thead = tbody.closest('table')?.tHead;
  if (thead) {
    document.documentElement.style.setProperty('--import-thead-h', thead.offsetHeight + 'px');
  }
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

  const floatLabel = document.getElementById('import-float-label');
  if (floatLabel) {
    const hasSelection = selected.length > 0;
    floatLabel.classList.toggle('toggle-no-selection', !hasSelection);
    floatLabel.title = hasSelection ? '' : t('import.floatToggleHint');
  }

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

  // Mark rows that would be auto-split by an enabled split rule (preview badge only; actual split happens server-side on import)
  _markAutoSplitRows(result.rows);

  // Initialise per-row UI flags
  State.importRows = result.rows.map(r => Object.assign(r, { _selected: false, _ignored: false, _locked: false, _storeMapping: false, _userPickedCategory: false, _userPickedProperty: false, _isDuplicate: false, _duplicateMatch: null, _userPickedIgnore: false }));

  _importCurrency = result.currency || '';
  _groupCollapsed = { 1: false, 2: true, 3: true, 4: true, 5: true, 6: true };
  _importSortCol  = null;
  _importSortDir  = 'asc';
  _updateImportSortIndicators();
  _updateLockBtn();
  const groupToggle = document.getElementById('import-group-toggle');
  const floatToggle = document.getElementById('import-float-toggle');
  if (groupToggle) groupToggle.checked = true;
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
    let errMsg = e.message;
    if (e.rowErrors) {
      errMsg = e.rowErrors.map(re => {
        const row = toSave[re.row];
        const id = row
          ? `${fmtDate(row.date)}, ${parseFloat(row.amount).toLocaleString()} ${row.currency || ''}${row.description ? ` "${row.description.slice(0, 30)}"` : ''}`
          : `row ${re.row + 1}`;
        const errs = Array.isArray(re.errors) ? re.errors.join(', ') : re.errors;
        return `${id}: ${errs}`;
      }).join('\n');
    }
    toast(t('import.toast.failed', { error: errMsg }), 'error');
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
let _repIncCats   = [];
let _repExpCats   = [];
let _repPnlRows   = [];
let _repShowNative = false;

function initReportTables() {
  repIncomeTable = DataTable.create({
    containerId: 'rep-income-table-wrap',
    title: t('reports.incomeByCat'),
    columns: [
      { key: 'category', label: t('reports.col.category'), sortable: true },
      { key: 'amount',   label: t('reports.col.amount'),   sortable: true, align: 'right' },
    ],
    fetchData: async () => ({ data: _repIncCats, total: _repIncCats.length }),
    renderRow: (c) => {
      const badge = _repShowNative && c.currency ? ` <span class="muted" style="font-size:0.75em">${c.currency}</span>` : '';
      return `<tr>
        <td data-col="category">${catLabel(c.category)}</td>
        <td data-col="amount" class="amount-cell positive">${Reports.fmt(c.amount, c.currency)}${badge}</td>
      </tr>`;
    },
    columnVisibility: { enabled: true, storageKey: 'datatable-rep-income' },
  });

  repExpenseTable = DataTable.create({
    containerId: 'rep-expense-table-wrap',
    title: t('reports.expensesByCat'),
    columns: [
      { key: 'category', label: t('reports.col.category'), sortable: true },
      { key: 'amount',   label: t('reports.col.amount'),   sortable: true, align: 'right' },
    ],
    fetchData: async () => ({ data: _repExpCats, total: _repExpCats.length }),
    renderRow: (c) => {
      const badge = _repShowNative && c.currency ? ` <span class="muted" style="font-size:0.75em">${c.currency}</span>` : '';
      return `<tr>
        <td data-col="category">${catLabel(c.category)}</td>
        <td data-col="amount" class="amount-cell negative">${Reports.fmt(c.amount, c.currency)}${badge}</td>
      </tr>`;
    },
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

function toggleRepCurrency() {
  _repShowNative = !_repShowNative;
  renderReports();
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

async function renderReports() {
  if (!repIncomeTable) initReportTables();

  const propId   = document.getElementById('rep-apt')?.value  || 'all';
  const dateFrom = parseDateToISO(document.getElementById('rep-from')?.value || '');
  const dateTo   = parseDateToISO(document.getElementById('rep-to')?.value   || '');
  const reportingCurrency = State.workspaceSettings?.reporting_currency || CONFIG.BASE_CURRENCY;

  _updateDateInputPlaceholders();

  // Sync toggle button label
  const currBtn = document.getElementById('rep-currency-btn');
  if (currBtn) currBtn.textContent = _repShowNative
    ? t('reports.showConverted', { currency: reportingCurrency })
    : t('reports.showNative');

  // Fetch aggregated P&L from backend
  try {
    const params = {};
    if (propId !== 'all') params.property_id = propId;
    if (dateFrom) params.from = dateFrom;
    if (dateTo)   params.to   = dateTo;

    const report = await Api.getPnlReport(params);

    if (_repShowNative) {
      // Native mode: one row per category+currency pair from the API
      const toNativeEntries = rows => rows.map(r => ({ category: r.category, amount: r.amount, currency: r.currency }))
        .sort((a, b) => b.amount - a.amount);
      _repIncCats = toNativeEntries(report.income);
      _repExpCats = toNativeEntries(report.expenses);
    } else {
      // Converted mode: aggregate by category, convert to reporting currency.
      // FX_RATES provides approximate rates for summary display (not bookkeeping).
      const aggregateByCategory = rows => {
        const map = {};
        rows.forEach(r => {
          const rate = CONFIG.FX_RATES[r.currency] ?? 1;
          if (!map[r.category]) map[r.category] = { category: r.category, amount: 0, currency: reportingCurrency };
          map[r.category].amount += r.amount * rate;
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount);
      };
      _repIncCats = aggregateByCategory(report.income);
      _repExpCats = aggregateByCategory(report.expenses);
    }

    // Metrics always shown in reporting currency (converted)
    const totalIncome   = report.income.reduce((s, r)   => s + r.amount * (CONFIG.FX_RATES[r.currency] ?? 1), 0);
    const totalExpenses = report.expenses.reduce((s, r) => s + r.amount * (CONFIG.FX_RATES[r.currency] ?? 1), 0);
    const net           = totalIncome - totalExpenses;

    document.getElementById('rep-metrics').innerHTML = `
      <div class="metric"><div class="m-label">${t('reports.metrics.totalIncome')}</div><div class="m-value positive">${Reports.fmt(totalIncome, reportingCurrency)}</div><div class="m-sub">${reportingCurrency} ${t('reports.metrics.equiv')}</div></div>
      <div class="metric"><div class="m-label">${t('reports.metrics.totalExpenses')}</div><div class="m-value negative">${Reports.fmt(totalExpenses, reportingCurrency)}</div><div class="m-sub">${reportingCurrency} ${t('reports.metrics.equiv')}</div></div>
      <div class="metric"><div class="m-label">${t('reports.metrics.net')}</div><div class="m-value ${net >= 0 ? 'positive' : 'negative'}">${Reports.fmt(net, reportingCurrency)}</div><div class="m-sub">${reportingCurrency} ${t('reports.metrics.equiv')}</div></div>
    `;
  } catch (e) {
    toast(t('reports.loadFailed', { error: e.message }), 'error');
    document.getElementById('rep-metrics').innerHTML = '';
    _repIncCats = [];
    _repExpCats = [];
  }

  // P&L by Property stays client-side (F4-3 scope)
  const filtered     = Reports.filter(State.transactions, { property_id: propId, date_from: dateFrom, date_to: dateTo });
  const visibleProps = propId !== 'all' ? State.properties.filter(p => p.id === propId) : State.properties;
  _repPnlRows = Object.values(Reports.pnl(filtered, visibleProps).byProperty);

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

function _buildCountryDropdown(selectedCode) {
  const sel = document.getElementById('apt-m-country');
  const usedCodes = [...new Set(State.properties.map(p => p.country).filter(Boolean))].sort((a, b) =>
    countryDisplayName(a).localeCompare(countryDisplayName(b)));
  const allSorted = ISO_COUNTRY_CODES.slice().sort((a, b) =>
    countryDisplayName(a).localeCompare(countryDisplayName(b)));

  let html = '';
  if (usedCodes.length) {
    html += usedCodes.map(c =>
      `<option value="${c}">${countryDisplayName(c)}</option>`).join('');
    html += `<option disabled>─────────────</option>`;
  }
  html += allSorted.map(c =>
    `<option value="${c}">${countryDisplayName(c)}</option>`).join('');
  sel.innerHTML = html;
  sel.value = selectedCode || usedCodes[0] || 'DK';
}

function openPropertyModal(propId) {
  State.editingAptId = propId || null;
  populateAllDropdowns();
  if (propId) {
    const p = State.properties.find(x => x.id === propId);
    if (!p) return;
    document.getElementById('apt-modal-title').textContent  = t('property.modal.editTitle');
    document.getElementById('apt-m-name').value     = p.name;
    document.getElementById('apt-m-addr').value     = p.address;
    document.getElementById('apt-m-currency').value = p.currency;
    document.getElementById('apt-m-model').value    = p.model || 'longterm';
    document.getElementById('apt-m-rent').value     = p.rent;
    document.getElementById('apt-m-aconto').value   = p.aconto;
    document.getElementById('apt-m-tenant').value   = p.tenant;
    document.getElementById('apt-m-lease').value    = p.lease_start;
    document.getElementById('apt-m-notes').value    = p.notes;
    _buildCountryDropdown(p.country);
  } else {
    document.getElementById('apt-modal-title').textContent = t('property.modal.addTitle');
    ['apt-m-name','apt-m-addr','apt-m-currency','apt-m-rent','apt-m-aconto','apt-m-tenant','apt-m-lease','apt-m-notes']
      .forEach(id => document.getElementById(id).value = '');
    _buildCountryDropdown(null);
    onAptCountryChange();
  }
  document.getElementById('modal-apt').style.display = 'flex';
}

function onAptCountryChange() {
  const country = document.getElementById('apt-m-country').value;
  document.getElementById('apt-m-currency').value = COUNTRY_CURRENCIES[country] || '';
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

// ── Accounts ──────────────────────────────────────────────

let _accountsState = null; // { accounts: [], maxDepth: 5 }

async function renderAccounts() {
  const tree  = document.getElementById('accounts-tree');
  const arch  = document.getElementById('accounts-archived');
  tree.innerHTML = `<div class="loading-state"><small>${t('common.loading')}</small></div>`;
  arch.innerHTML = '';

  try {
    const [accounts, wsSettings] = await Promise.all([
      Api.getAccounts({ status: 'all' }),
      Api.getWorkspaceSettings(),
    ]);
    _accountsState = { accounts, maxDepth: wsSettings.max_account_depth || 5 };
    _renderAccountsTree();
  } catch (e) {
    tree.innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function _renderAccountsTree() {
  if (!_accountsState) return;
  const { accounts } = _accountsState;
  const active   = accounts.filter(a => a.is_active);
  const archived = accounts.filter(a => !a.is_active);

  document.getElementById('accounts-tree').innerHTML =
    active.length ? _buildAccountTree(active) : `<div class="empty-state">${t('accounts.noAccounts')}</div>`;

  const archEl = document.getElementById('accounts-archived');
  if (archived.length) {
    archEl.innerHTML = `
      <details>
        <summary style="cursor:pointer;font-size:13px;color:var(--text3);margin-bottom:0.5rem">
          ${t('accounts.archivedSection')} (${archived.length})
        </summary>
        <div style="margin-top:0.5rem">${_buildAccountTree(archived, true)}</div>
      </details>`;
  } else {
    archEl.innerHTML = '';
  }
}

function _buildAccountTree(accounts, readOnly = false) {
  // Build a flat map then render as an indented list
  const byId   = Object.fromEntries(accounts.map(a => [a.id, a]));
  const roots  = accounts.filter(a => !a.parent_account_id || !byId[a.parent_account_id]);

  function renderNode(account, prefix, isLast, isRoot) {
    const children = accounts.filter(a => a.parent_account_id === account.id);
    const defaultBadge = account.is_default
      ? `<span class="badge badge-info" style="margin-left:6px">${t('accounts.defaultBadge')}</span>` : '';
    const viewBtn = `<button class="btn-link" onclick="openLinkedItemsModal('${account.id}')">${t('accounts.linkedItems.viewBtn')}</button>`;
    const actions = readOnly
      ? `<span class="row-actions">${viewBtn}</span>`
      : `<span class="row-actions">
        ${viewBtn}
        <button class="btn-link" onclick="openEditAccountModal('${account.id}')">${t('common.edit')}</button>
        ${!account.is_default ? `<button class="btn-link" onclick="confirmDeleteAccount('${account.id}')">${t('common.delete')}</button>` : ''}
        ${!account.is_default && !account.parent_account_id ? `<button class="btn-link" onclick="confirmSetDefault('${account.id}')">${t('accounts.setDefault')}</button>` : ''}
      </span>`;

    const connector   = isRoot ? '' : (isLast ? '└─ ' : '├─ ');
    const childPrefix = isRoot ? '' : (isLast ? '   ' : '│  ');
    const prefixHtml  = connector
      ? `<span class="account-tree-prefix">${prefix}${connector}</span>`
      : '';

    return `
      <div class="account-node">
        ${prefixHtml}<span class="account-name">${escHtml(account.name)}</span>${defaultBadge}${actions}
      </div>
      ${children.map((c, i) => renderNode(c, prefix + childPrefix, i === children.length - 1, false)).join('')}`;
  }

  return roots.map((r, i) => renderNode(r, '', i === roots.length - 1, true)).join('');
}

function openAddAccountModal(parentId = null) {
  _openAccountModal(null, parentId);
}

function openEditAccountModal(id) {
  const account = _accountsState?.accounts.find(a => a.id === id);
  if (account) _openAccountModal(account, null);
}

function _openAccountModal(account, defaultParentId) {
  const accs       = _accountsState?.accounts.filter(a => a.is_active) || [];
  const maxDepth   = _accountsState?.maxDepth || 5;
  const isEdit     = !!account;
  const title      = isEdit ? t('accounts.modal.editTitle') : t('accounts.modal.addTitle');
  const parentOpts = accs
    .filter(a => !isEdit || a.id !== account.id)
    .map(a => {
      const sel = (defaultParentId && a.id === defaultParentId) ||
                  (isEdit && a.id === account.parent_account_id) ? 'selected' : '';
      return `<option value="${a.id}" ${sel}>${escHtml(a.name)}</option>`;
    })
    .join('');

  document.getElementById('modal-account').innerHTML = `
    <div class="modal-content" style="min-width:340px">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="closeAccountModal()">&times;</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="acc-m-id" value="${isEdit ? account.id : ''}">
        <div class="form-group">
          <label>${t('accounts.modal.name')}</label>
          <input type="text" id="acc-m-name" value="${isEdit ? escHtml(account.name) : ''}" maxlength="255" required>
        </div>
        <div class="form-group">
          <label>${t('accounts.modal.parent')}</label>
          <select id="acc-m-parent">
            <option value="">${t('accounts.modal.noParent')}</option>
            ${parentOpts}
          </select>
          <small>${t('accounts.modal.depthHint', { max: maxDepth })}</small>
        </div>
        ${isEdit ? `<div class="form-group">
          <label>${t('accounts.modal.notes')}</label>
          <textarea id="acc-m-notes" rows="2">${escHtml(account.notes || '')}</textarea>
        </div>` : ''}
      </div>
      <div class="modal-footer btn-row">
        <button class="btn btn-primary btn-sm" onclick="saveAccountModal()">${isEdit ? t('common.save') : t('accounts.modal.createBtn')}</button>
        <button class="btn btn-secondary btn-sm" onclick="closeAccountModal()">${t('common.cancel')}</button>
      </div>
    </div>`;
  document.getElementById('modal-account').style.display = 'flex';
}

function closeAccountModal() { document.getElementById('modal-account').style.display = 'none'; }

async function saveAccountModal() {
  const id     = document.getElementById('acc-m-id').value;
  const name   = document.getElementById('acc-m-name').value.trim();
  const parent = document.getElementById('acc-m-parent').value || null;
  const notes  = document.getElementById('acc-m-notes')?.value.trim() || undefined;

  if (!name) { toast(t('accounts.toast.nameReq'), 'error'); return; }

  // Client-side depth guard
  if (parent && _accountsState) {
    const depth = _calcDepth(parent, _accountsState.accounts);
    if (depth >= _accountsState.maxDepth) {
      toast(t('accounts.toast.depthExceeded', { max: _accountsState.maxDepth }), 'error');
      return;
    }
  }

  setLoading(true, t('status.saving'));
  try {
    if (id) {
      const body = { name, parent_account_id: parent };
      if (notes !== undefined) body.notes = notes;
      await Api.updateAccount(id, body);
    } else {
      await Api.createAccount({ name, parent_account_id: parent });
    }
    closeAccountModal();
    await renderAccounts();
    toast(t('accounts.toast.saved'), 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
  setLoading(false);
}

function _calcDepth(accountId, accounts) {
  // Returns 1-based depth of accountId in the tree (root = depth 1)
  let depth = 1;
  let id    = accountId;
  const byId = Object.fromEntries(accounts.map(a => [a.id, a]));
  while (byId[id]?.parent_account_id) {
    depth++;
    id = byId[id].parent_account_id;
    if (depth > 20) break; // cycle guard
  }
  return depth;
}

async function confirmSetDefault(id) {
  const account = _accountsState?.accounts.find(a => a.id === id);
  if (!account) return;
  if (!confirm(t('accounts.toast.setDefaultConfirm', { name: account.name }))) return;
  setLoading(true, t('status.saving'));
  try {
    await Api.setDefaultAccount(id);
    await renderAccounts();
    toast(t('accounts.toast.defaultSet'), 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
  setLoading(false);
}

async function openLinkedItemsModal(id) {
  const account = _accountsState?.accounts.find(a => a.id === id);
  if (!account) return;

  const modalEl = document.getElementById('modal-account');
  const header = `
    <div class="modal-header">
      <span class="modal-title">${t('accounts.linkedItems.title', { name: escHtml(account.name) })}</span>
      <button class="modal-close" onclick="closeAccountModal()">&times;</button>
    </div>`;

  modalEl.innerHTML = `<div class="modal-content" style="min-width:400px;max-width:660px">
    ${header}
    <div class="modal-body"><p style="color:var(--text3)">${t('common.loading')}</p></div>
  </div>`;
  modalEl.style.display = 'flex';

  try {
    const items = await Api.getAccountItems(id);

    const txRows = items.transactions.length
      ? items.transactions.map(tx => `
          <tr class="clickable-row" onclick="closeAccountModal();showPage('transactions',document.querySelector('nav button:nth-child(2)'));openTxModal('${tx.id}')">
            <td>${fmtDate(tx.date)}</td>
            <td>${escHtml(tx.description || '')}</td>
            <td style="text-align:right">${parseFloat(tx.amount).toLocaleString()}</td>
            <td>${escHtml(tx.currency || '')}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="color:var(--text3);font-style:italic">${t('accounts.linkedItems.noTx')}</td></tr>`;

    const propRows = items.properties.length
      ? items.properties.map(p => `
          <tr class="clickable-row" onclick="closeAccountModal();showPage('properties',document.querySelector('nav button:nth-child(5)'));openPropertyModal('${p.id}')">
            <td>${escHtml(p.name)}</td>
            <td>${escHtml(p.address || '')}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" style="color:var(--text3);font-style:italic">${t('accounts.linkedItems.noProps')}</td></tr>`;

    modalEl.innerHTML = `<div class="modal-content" style="min-width:400px;max-width:660px">
      ${header}
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text3);margin-bottom:1.25rem">
          ${t('accounts.linkedItems.summary', { tx: items.transaction_count, props: items.property_count })}
        </p>
        <h4 style="margin:0 0 0.5rem">${t('accounts.linkedItems.txSection')}</h4>
        <table class="data-table" style="margin-bottom:1.5rem;width:100%">
          <thead><tr>
            <th>${t('tx.col.date')}</th>
            <th>${t('tx.col.description')}</th>
            <th style="text-align:right">${t('tx.col.amount')}</th>
            <th>${t('accounts.linkedItems.colCurrency')}</th>
          </tr></thead>
          <tbody>${txRows}</tbody>
        </table>
        <h4 style="margin:0 0 0.5rem">${t('accounts.linkedItems.propSection')}</h4>
        <table class="data-table" style="width:100%">
          <thead><tr>
            <th>${t('accounts.linkedItems.colName')}</th>
            <th>${t('accounts.linkedItems.colAddress')}</th>
          </tr></thead>
          <tbody>${propRows}</tbody>
        </table>
      </div>
      <div class="modal-footer btn-row">
        <button class="btn btn-secondary btn-sm" onclick="closeAccountModal()">${t('common.close')}</button>
      </div>
    </div>`;
  } catch (e) {
    modalEl.innerHTML = `<div class="modal-content" style="min-width:340px">
      ${header}
      <div class="modal-body"><p style="color:var(--error)">${escHtml(e.message)}</p></div>
      <div class="modal-footer btn-row">
        <button class="btn btn-secondary btn-sm" onclick="closeAccountModal()">${t('common.close')}</button>
      </div>
    </div>`;
  }
}

async function confirmDeleteAccount(id) {
  const account  = _accountsState?.accounts.find(a => a.id === id);
  const active   = _accountsState?.accounts.filter(a => a.is_active && a.id !== id) || [];
  if (!account) return;

  // Fetch linked counts then show picker
  let counts = { transaction_count: 0, property_count: 0 };
  try {
    const detail = await Api.getAccount(id);
    counts = { transaction_count: detail.transaction_count || 0, property_count: detail.property_count || 0 };
  } catch (_) {}

  const opts = active.map(a =>
    `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');

  document.getElementById('modal-account').innerHTML = `
    <div class="modal-content" style="min-width:340px">
      <div class="modal-header">
        <span class="modal-title">${t('accounts.modal.deleteTitle')}</span>
        <button class="modal-close" onclick="closeAccountModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p>${t('accounts.modal.deleteDesc', { name: escHtml(account.name) })}</p>
        <p style="font-size:13px;color:var(--text3)">
          ${t('accounts.modal.deleteCounts', { tx: counts.transaction_count, props: counts.property_count })}
        </p>
        <div class="form-group" style="margin-top:1rem">
          <label>${t('accounts.modal.reassignTo')}</label>
          <select id="acc-m-reassign">${opts}</select>
        </div>
      </div>
      <div class="modal-footer btn-row">
        <button class="btn btn-danger btn-sm" onclick="executeDeleteAccount('${id}')">${t('accounts.modal.deleteBtn')}</button>
        <button class="btn btn-secondary btn-sm" onclick="closeAccountModal()">${t('common.cancel')}</button>
      </div>
    </div>`;
  document.getElementById('modal-account').style.display = 'flex';
}

async function executeDeleteAccount(id) {
  const reassign_to = document.getElementById('acc-m-reassign').value;
  if (!reassign_to) { toast(t('accounts.toast.reassignReq'), 'error'); return; }
  setLoading(true, t('status.saving'));
  try {
    await Api.deleteAccount(id, reassign_to);
    closeAccountModal();
    await renderAccounts();
    toast(t('accounts.toast.deleted'), 'success');
  } catch (e) {
    toast(e.message, 'error');
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

// ── Split rules ───────────────────────────────────────────

const SR_FIELDS = [
  { value: 'account_id',  label: 'Account' },
  { value: 'property_id', label: 'Property' },
  { value: 'amount',      label: 'Amount' },
  { value: 'description', label: 'Description' },
];
const SR_OPS = {
  account_id:  [],   // multiselect — no operator shown
  property_id: [],   // multiselect — no operator shown
  amount:      [{ value: 'equals',       label: '=' },
                { value: 'greater_than', label: '>' },
                { value: 'less_than',    label: '<' }],
  description: [{ value: 'contains',    label: 'contains' },
                { value: 'equals',      label: '=' }],
};

function _isIdField(field) {
  return field === 'account_id' || field === 'property_id';
}

// Returns the display label for a set of selected IDs (shown in the picker button).
function _srIdPickerLabel(field, ids) {
  if (!ids.length) return 'All';
  if (field === 'account_id') {
    const accounts = _accountsState?.accounts || [];
    return ids.map(id => accounts.find(a => a.id === id)?.name || id).join(', ');
  }
  return ids.map(id => State.properties.find(p => p.id === id)?.name || id).join(', ');
}

// Builds the clickable display pill for account_id / property_id conditions.
function _srIdPickerDisplayHtml(field, selectedIds) {
  const ids   = Array.isArray(selectedIds) ? selectedIds : [];
  const label = _srIdPickerLabel(field, ids);
  const json  = _esc(JSON.stringify(ids));
  return `<button type="button" class="sr-cond-val sr-id-picker-btn" data-field="${field}" data-selected="${json}"
    onclick="_openIdPickerPopup(this)"
    style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:3px 8px;font-size:13px;cursor:pointer"
    >${_esc(label)}</button>`;
}

// ── ID picker popup ───────────────────────────────────────
let _idPickerTarget = null; // the .sr-id-picker-btn that opened the popup

function _openIdPickerPopup(btn) {
  _idPickerTarget = btn;
  const field    = btn.dataset.field;
  const selected = JSON.parse(btn.dataset.selected || '[]');

  document.getElementById('id-picker-title').textContent =
    field === 'account_id' ? 'Select accounts' : 'Select properties';

  const list = document.getElementById('id-picker-list');
  let items = [];
  if (field === 'account_id') {
    items = (_accountsState?.accounts || []).filter(a => a.is_active).map(a => ({ id: a.id, label: a.name }));
  } else {
    items = State.properties.filter(p => !p.archived).map(p => ({ id: p.id, label: p.name }));
  }

  const allChecked = selected.length === 0;
  list.textContent = '';

  // Use a table so the text <td> is completely isolated from the checkbox's layout box.
  // The global CSS rule `input { width:100%; padding:8px 10px }` bloats checkboxes
  // as inline elements; putting them in their own <td> avoids that entirely.
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;width:100%';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const addRow = (id, labelText, checked, isAll) => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';

    const tdCb = document.createElement('td');
    tdCb.style.cssText = 'width:1px;padding:4px 8px 4px 0;vertical-align:middle';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = id;
    cb.checked = checked;
    cb.style.cssText = 'width:auto;padding:0;margin:0;vertical-align:middle;cursor:pointer;flex-shrink:0';
    if (isAll) {
      cb.id = 'id-picker-all';
      cb.addEventListener('change', () => _onIdPickerAllChange(cb));
    } else {
      cb.className = 'id-picker-item';
      cb.addEventListener('change', () => _onIdPickerItemChange(cb));
    }
    tdCb.appendChild(cb);

    const tdLabel = document.createElement('td');
    tdLabel.style.cssText = 'padding:4px 0;font-size:13px;color:var(--text);white-space:nowrap;vertical-align:middle' + (isAll ? ';font-weight:500' : '');
    tdLabel.textContent = labelText;

    tr.appendChild(tdCb);
    tr.appendChild(tdLabel);
    tr.addEventListener('click', e => { if (e.target !== cb) cb.click(); });
    tbody.appendChild(tr);
  };

  addRow('', 'All', allChecked, true);
  items.forEach(item => addRow(item.id, item.label, selected.includes(item.id), false));
  list.appendChild(table);

  document.getElementById('modal-id-picker').style.display = 'flex';
}

function _closeIdPickerPopup() {
  document.getElementById('modal-id-picker').style.display = 'none';
  _idPickerTarget = null;
}

function _applyIdPickerSelection() {
  if (!_idPickerTarget) return;
  const field    = _idPickerTarget.dataset.field;
  const selected = [...document.querySelectorAll('.id-picker-item:checked')].map(cb => cb.value);
  _idPickerTarget.dataset.selected = JSON.stringify(selected);
  _idPickerTarget.textContent = _srIdPickerLabel(field, selected);
  _closeIdPickerPopup();
}

function _onIdPickerAllChange(cb) {
  if (cb.checked) {
    document.querySelectorAll('.id-picker-item').forEach(el => { el.checked = false; });
  }
}

function _onIdPickerItemChange(cb) {
  if (cb.checked) {
    const allCb = document.getElementById('id-picker-all');
    if (allCb) allCb.checked = false;
  } else {
    const anyChecked = [...document.querySelectorAll('.id-picker-item')].some(el => el.checked);
    if (!anyChecked) {
      const allCb = document.getElementById('id-picker-all');
      if (allCb) allCb.checked = true;
    }
  }
}

let _srEditingId = null;
let _srFromSplitContext = false;
let _srSourceTx = null; // source transaction when opening from a manual split

function renderSplitRulesList() {
  const container = document.getElementById('split-rules-list');
  if (!container) return;
  if (!State.splitRules.length) {
    container.innerHTML = `<p style="color:var(--text3);font-size:13px">${t('splitRules.noRules')}<br><span style="font-size:12px">${t('splitRules.noRulesSub')}</span></p>`;
    return;
  }
  container.innerHTML = State.splitRules.map(r => `
    <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;margin-bottom:2px">${_esc(r.name)}</div>
        <div style="font-size:11px;color:var(--text3)">
          ${r.conditions.map(c => {
            const displayVal = Array.isArray(c.value)
              ? (c.value.length === 0 ? 'all' : c.value.length + ' selected')
              : c.value;
            return `${c.field} ${c.operator} "${displayVal}"`;
          }).join(' AND ')}
          &nbsp;→&nbsp;
          ${r.template.length} rows (${r.template[0]?.amount_type || '?'})
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer">
        <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleSplitRuleEnabled('${r.id}', this.checked)">
        On
      </label>
      <button class="btn btn-sm btn-secondary" onclick="openSplitRuleModal('${r.id}')" style="white-space:nowrap">Edit</button>
    </div>`).join('');
}

async function openSplitRuleModal(editId, prefill) {
  // Ensure accounts are loaded (they are lazy-loaded only when the accounts page is visited)
  if (!_accountsState) {
    try {
      const [accounts, wsSettings] = await Promise.all([
        Api.getAccounts({ status: 'all' }),
        Api.getWorkspaceSettings(),
      ]);
      _accountsState = { accounts, maxDepth: wsSettings.max_account_depth || 5 };
    } catch (e) {
      _accountsState = { accounts: [], maxDepth: 5 };
    }
  }

  _srEditingId = editId || null;
  _srFromSplitContext = false;
  _srSourceTx = prefill?._sourceTx || null;

  const title = document.getElementById('split-rule-modal-title');
  title.textContent = _srEditingId ? t('splitRules.modal.titleEdit') : t('splitRules.modal.titleAdd');

  document.getElementById('sr-m-delete-btn').style.display = _srEditingId ? 'inline-block' : 'none';

  // Reset form
  document.getElementById('sr-m-name').value = '';
  document.getElementById('sr-m-enabled').checked = true;
  document.getElementById('sr-m-mode-fixed').checked = true;
  document.getElementById('sr-m-conditions').innerHTML = '';
  document.getElementById('sr-m-template-tbody').innerHTML = '';

  if (_srEditingId) {
    const rule = State.splitRules.find(r => r.id === _srEditingId);
    if (rule) {
      document.getElementById('sr-m-name').value = rule.name;
      document.getElementById('sr-m-enabled').checked = rule.enabled;
      const mode = rule.template[0]?.amount_type || 'fixed';
      document.getElementById(mode === 'percent' ? 'sr-m-mode-percent' : 'sr-m-mode-fixed').checked = true;
      rule.conditions.forEach(c => _addSrConditionRow(c.field, c.operator, c.value));
      rule.template.forEach(r => _addSrTemplateRow(r.type, r.category, r.description, r.amount_value));
    }
  } else if (prefill) {
    document.getElementById('sr-m-name').value = prefill.name || '';
    const mode = prefill.mode || 'fixed';
    document.getElementById(mode === 'percent' ? 'sr-m-mode-percent' : 'sr-m-mode-fixed').checked = true;
    (prefill.conditions || []).forEach(c => _addSrConditionRow(c.field, c.operator, c.value));
    (prefill.template  || []).forEach(r => _addSrTemplateRow(r.type, r.category, r.description, r.amount_value));
  } else {
    _addSrConditionRow('amount', 'equals', '');
    _addSrTemplateRow('income', '', '', '');
    _addSrTemplateRow('expense', '', '', '');
  }

  _updateSrModeHeader();
  _updateSrTemplateSummary();
  document.getElementById('modal-split-rule').style.display = 'flex';
}

async function openSplitRuleModalFromSplit() {
  const tx   = State.transactions.find(t => t.id === State._lastSavedSplitTxId);
  const rows = State._lastSavedSplitRows || [];
  if (!tx || !rows.length) { await openSplitRuleModal(null); return; }

  const prefill = {
    name: '',
    mode: 'fixed',
    conditions: [
      { field: 'description', operator: 'contains', value: tx.description || '' },
    ],
    template: rows.map(r => ({
      type:         r.type,
      category:     r.category,
      description:  r.description || '',
      amount_value: r.amount,
    })),
    _sourceTx: tx,
  };
  await openSplitRuleModal(null, prefill);
  // Set context flag after modal is open so _onSrCondFieldChange can reference it
  _srFromSplitContext = true;
}

function closeSplitRuleModal() {
  document.getElementById('modal-split-rule').style.display = 'none';
  _srEditingId = null;
  _srFromSplitContext = false;
  _srSourceTx = null;
}

async function saveSplitRuleModal() {
  const name    = document.getElementById('sr-m-name').value.trim();
  const enabled = document.getElementById('sr-m-enabled').checked;
  const mode    = document.querySelector('input[name="sr-m-mode"]:checked')?.value || 'fixed';

  if (!name) { toast(t('splitRules.toast.nameReq'), 'error'); return; }

  const condRows = document.querySelectorAll('.sr-cond-row');
  if (!condRows.length) { toast(t('splitRules.toast.condReq'), 'error'); return; }
  const conditions = [...condRows].map(row => {
    const field   = row.querySelector('.sr-cond-field').value;
    if (_isIdField(field)) {
      const btn      = row.querySelector('.sr-id-picker-btn');
      const selected = JSON.parse(btn?.dataset.selected || '[]');
      return { field, operator: 'in', value: selected };
    }
    return {
      field,
      operator: row.querySelector('.sr-cond-op').value,
      value:    row.querySelector('.sr-cond-val').value,
    };
  });

  const tmplRows = document.querySelectorAll('#sr-m-template-tbody tr');
  if (tmplRows.length < 2) { toast(t('splitRules.toast.templateReq'), 'error'); return; }
  const template = [...tmplRows].map(row => ({
    type:         row.querySelector('.sr-tmpl-type').value,
    category:     row.querySelector('.sr-tmpl-cat').value,
    description:  row.querySelector('.sr-tmpl-desc').value.trim(),
    amount_type:  mode,
    amount_value: parseFloat(row.querySelector('.sr-tmpl-amt').value) || 0,
  }));

  if (mode === 'percent') {
    const sum = template.reduce((s, r) => s + r.amount_value, 0);
    if (Math.abs(sum - 100) > 0.001) { toast(t('splitRules.toast.pctSum'), 'error'); return; }
  }

  try {
    if (_srEditingId) {
      const updated = await Api.updateSplitRule(_srEditingId, { name, enabled, conditions, template });
      const idx = State.splitRules.findIndex(r => r.id === _srEditingId);
      if (idx !== -1) State.splitRules[idx] = updated;
    } else {
      const created = await Api.createSplitRule({ name, enabled, conditions, template });
      State.splitRules.push(created);
    }
    renderSplitRulesList();
    closeSplitRuleModal();
    toast(t('splitRules.toast.saved'), 'success');
  } catch(e) {
    const detail = Array.isArray(e.rowErrors) ? e.rowErrors.join('; ') : e.message;
    toast(t('splitRules.toast.saveFailed', { error: detail }), 'error');
  }
}

async function deleteSplitRuleModal() {
  if (!_srEditingId) return;
  if (!confirm('Delete this split rule?')) return;
  try {
    await Api.deleteSplitRule(_srEditingId);
    State.splitRules = State.splitRules.filter(r => r.id !== _srEditingId);
    renderSplitRulesList();
    closeSplitRuleModal();
    toast(t('splitRules.toast.deleted'), 'success');
  } catch(e) {
    toast(t('splitRules.toast.saveFailed', { error: e.message }), 'error');
  }
}

async function toggleSplitRuleEnabled(id, enabled) {
  try {
    const updated = await Api.updateSplitRule(id, { enabled });
    const idx = State.splitRules.findIndex(r => r.id === id);
    if (idx !== -1) State.splitRules[idx] = updated;
  } catch(e) {
    toast(t('splitRules.toast.saveFailed', { error: e.message }), 'error');
    renderSplitRulesList(); // revert toggle
  }
}

function addSplitRuleCondition() {
  _addSrConditionRow('amount', 'equals', '');
}

function _addSrConditionRow(field, operator, value) {
  const container = document.getElementById('sr-m-conditions');
  const row = document.createElement('div');
  row.className = 'sr-cond-row';
  row.style.cssText = 'display:flex;gap:0.4rem;align-items:center;margin-bottom:0.4rem';

  const idField   = _isIdField(field);
  const fieldOpts = SR_FIELDS.map(f => `<option value="${f.value}" ${f.value === field ? 'selected' : ''}>${f.label}</option>`).join('');
  const ops    = SR_OPS[field] || SR_OPS.amount;
  const opOpts = ops.map(o => `<option value="${o.value}" ${o.value === operator ? 'selected' : ''}>${o.label}</option>`).join('');

  const valueWidget = idField
    ? _srIdPickerDisplayHtml(field, Array.isArray(value) ? value : [])
    : `<input type="text" class="sr-cond-val" value="${_esc(value || '')}" style="flex:1;min-width:0">`;

  row.innerHTML = `
    <select class="sr-cond-field" onchange="_onSrCondFieldChange(this)" style="flex:none;width:auto">${fieldOpts}</select>
    <select class="sr-cond-op" style="flex:none;width:auto;${idField ? 'display:none' : ''}">${opOpts}</select>
    ${valueWidget}
    <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;flex:none" onclick="this.closest('.sr-cond-row').remove()">✕</button>`;
  container.appendChild(row);
}

function _onSrCondFieldChange(sel) {
  const row     = sel.closest('.sr-cond-row');
  const field   = sel.value;
  const idField = _isIdField(field);
  const opSel   = row.querySelector('.sr-cond-op');

  // Show/hide operator select
  opSel.style.display = idField ? 'none' : '';
  if (!idField) {
    const ops = SR_OPS[field] || SR_OPS.amount;
    opSel.innerHTML = ops.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  }

  // Replace the value widget, pre-populating from the source transaction when available
  const existing = row.querySelector('.sr-cond-val');
  if (idField) {
    // Pre-select the transaction's account or property if we have a source tx
    let preSelected = [];
    if (_srSourceTx) {
      const txVal = field === 'account_id' ? _srSourceTx.account_id : _srSourceTx.property_id;
      if (txVal) preSelected = [txVal];
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = _srIdPickerDisplayHtml(field, preSelected);
    existing.replaceWith(tmp.firstElementChild);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sr-cond-val';
    input.style.cssText = 'flex:1;min-width:0';
    // Pre-populate from source transaction
    if (_srSourceTx) {
      if (field === 'description') input.value = _srSourceTx.description || '';
      if (field === 'amount')      input.value = _srSourceTx.amount != null ? String(_srSourceTx.amount) : '';
    }
    if (existing.tagName !== 'INPUT') existing.replaceWith(input);
    else existing.replaceWith(input);
  }
}

function addSplitRuleTemplateRow() {
  _addSrTemplateRow('expense', '', '', '');
  _updateSrTemplateSummary();
}

function _addSrTemplateRow(type, category, description, amtValue) {
  const tbody = document.getElementById('sr-m-template-tbody');
  const tr    = document.createElement('tr');

  const typeOpts = ['income','expense','deposit','transfer']
    .map(v => `<option value="${v}" ${v === type ? 'selected' : ''}>${t('categories.' + v)}</option>`)
    .join('');

  tr.innerHTML = `
    <td style="padding:3px"><select class="sr-tmpl-type" onchange="_onSrTmplTypeChange(this)">${typeOpts}</select></td>
    <td style="padding:3px"><select class="sr-tmpl-cat"></select></td>
    <td style="padding:3px"><input type="text" class="sr-tmpl-desc" value="${_esc(description)}" style="width:100%"></td>
    <td style="padding:3px"><input type="number" class="sr-tmpl-amt" min="0.01" step="0.01" value="${amtValue || ''}" oninput="_updateSrTemplateSummary()" style="width:80px;text-align:right"></td>
    <td style="padding:3px;text-align:center"><button class="btn btn-sm" style="padding:2px 6px;font-size:11px" onclick="this.closest('tr').remove();_updateSrTemplateSummary()">✕</button></td>`;

  tbody.appendChild(tr);
  _populateSplitCatSelect(tr.querySelector('.sr-tmpl-cat'), type, category);
}

function _onSrTmplTypeChange(sel) {
  const row = sel.closest('tr');
  _populateSplitCatSelect(row.querySelector('.sr-tmpl-cat'), sel.value, '');
  _updateSrTemplateSummary();
}

function onSplitRuleModeChange() {
  _updateSrModeHeader();
  _updateSrTemplateSummary();
}

function _updateSrModeHeader() {
  const mode = document.querySelector('input[name="sr-m-mode"]:checked')?.value || 'fixed';
  const hdr  = document.getElementById('sr-m-amount-header');
  if (hdr) hdr.textContent = mode === 'percent' ? t('splitRules.modal.amountHeaderPct') : t('splitRules.modal.amountHeaderFixed');
}

function _updateSrTemplateSummary() {
  const mode = document.querySelector('input[name="sr-m-mode"]:checked')?.value || 'fixed';
  const rows = document.querySelectorAll('#sr-m-template-tbody tr');
  const sum  = [...rows].reduce((s, r) => s + (parseFloat(r.querySelector('.sr-tmpl-amt')?.value) || 0), 0);
  const el   = document.getElementById('sr-m-template-summary');
  if (!el) return;
  if (mode === 'percent') {
    const ok = Math.abs(sum - 100) < 0.001;
    el.innerHTML = ok
      ? `<span style="color:var(--success)">✓ 100%</span>`
      : `<span style="color:var(--red)">${sum.toFixed(2)}% of 100%</span>`;
  } else {
    el.textContent = `Total: ${sum.toFixed(2)}`;
  }
}

async function applyToSimilar() {
  const tx   = State.transactions.find(t => t.id === State._lastSavedSplitTxId);
  const rows = State._lastSavedSplitRows || [];
  if (!tx || !rows.length) return;

  const similar = State.transactions.filter(s =>
    s.id !== tx.id &&
    s.account_id === tx.account_id &&
    Math.abs(parseFloat(s.amount) - parseFloat(tx.amount)) < 0.001 &&
    !s.parent_transaction_id &&
    (s.split_count || 0) === 0
  );

  if (!similar.length) { toast('No similar unsplit transactions found.', 'info'); return; }

  const names = similar.slice(0, 5).map(s => `${fmtDate(s.date)}: ${s.description || '—'} (${s.amount})`).join('\n');
  const extra = similar.length > 5 ? `\n…and ${similar.length - 5} more` : '';
  if (!confirm(`Apply this split to ${similar.length} similar transaction(s)?\n\n${names}${extra}`)) return;

  setLoading(true, t('status.saving'));
  let applied = 0;
  try {
    for (const s of similar) {
      await Api.saveSplits(s.id, rows);
      applied++;
    }
    await refreshAll();
    closeTxModal();
    toast(`Split applied to ${applied} transaction(s).`, 'success');
  } catch(e) {
    toast(t('tx.toast.saveFailed', { error: e.message }), 'error');
  }
  setLoading(false);
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
  const ms = msg.includes('\n') ? 8000 : 4000;
  setTimeout(() => el.remove(), ms);
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
  openSplitEditor, closeSplitEditor, addSplitRow, removeSplitsConfirm,
  _fillSplitRemaining, _removeSplitRow, _onSplitTypeChange, _updateSplitRemaining,
  toggleSplitRows, toggleAllSplits,
  toggleReconciled, deleteTxWithConfirm,
  onProfileChange, onImportFileChange, onImportDragOver, onImportDragLeave, onImportDrop,
  toggleImportPaste, clearImport, runImportPreview, renderImportTable, toggleImportSection, _updatePreviewBtnState,
  toggleSelectAll, onRowSelect, onRowFieldChange, onImportLockBtnClick, sortImportCol,
  refreshSavedMappingsDropdown, loadSavedMapping, saveCurrentMapping, deleteSavedMapping,
  goToStaticPreview, backToEditPreview, goToMappingConfirmOrImport, backToStaticPreview,
  toggleTree, doImport,
  toggleImportHistory, undoImportBatch, closeUndoModal, confirmUndoImport,
  onDateFilterInput,
  setReportYear, setReportPeriod, toggleRepCurrency, renderReports,
  openPropertyModal, closePropertyModal, savePropertyModal, onAptCountryChange, archiveProperty,
  openAddAccountModal, openEditAccountModal, closeAccountModal, saveAccountModal,
  openLinkedItemsModal, confirmSetDefault, confirmDeleteAccount, executeDeleteAccount,
  openRuleModal, closeRuleModal, saveRuleModal, saveRules, loadDefaultRules, deleteRule,
  openSplitRuleModal, openSplitRuleModalFromSplit, closeSplitRuleModal, saveSplitRuleModal, deleteSplitRuleModal,
  addSplitRuleCondition, addSplitRuleTemplateRow, onSplitRuleModeChange,
  toggleSplitRuleEnabled, _onSrCondFieldChange, _onSrTmplTypeChange, _updateSrTemplateSummary,
  _openIdPickerPopup, _closeIdPickerPopup, _applyIdPickerSelection, _onIdPickerAllChange, _onIdPickerItemChange,
  applyToSimilar,
  saveSettings, toggleAddRateForm, submitAddRate, deleteRate,
  toggleAddCategoryForm, submitAddCategory, deleteCategoryItem,
  onCatLabelBlur, toggleCategoryActive,
  openEditCategoryForm, submitEditCategory, closeEditCategoryForm,
  openNewCategoryModal, closeNewCategoryModal, _newCatCodeAutoFill, submitNewCategoryFromImport,
});
