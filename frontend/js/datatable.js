/* DataTable — reusable table component */
const DataTable = (() => {

  function create(config) {
    // Required
    const { containerId, columns, fetchData, renderRow } = config;

    // Optional
    const title          = config.title       || '';
    const actions        = config.actions     || [];
    const pagination     = config.pagination  || { enabled: false };
    const bulkActions    = config.bulkActions || [];
    const colVis         = config.columnVisibility || { enabled: false };

    // ── State ─────────────────────────────────────────────────────
    const sortState = { col: null, dir: 'asc' };
    const filterState = {};      // key → value
    let page        = 1;
    let limit       = (pagination.enabled && pagination.defaultLimit) || 50;
    let selectedIds = new Set();

    // Column visibility — initialise from localStorage or defaultVisible
    let visibleCols = _initVisibility(columns, colVis);

    // ── Bootstrap ─────────────────────────────────────────────────
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`DataTable: no element #${containerId}`);

    container.innerHTML = _buildShell(title, actions, columns, pagination, bulkActions, colVis);

    _attachEvents();
    _load();

    // ── Public API ────────────────────────────────────────────────
    const instance = {
      refresh() { _load(); },
      reset() {
        page = 1;
        sortState.col = null;
        sortState.dir = 'asc';
        Object.keys(filterState).forEach(k => { filterState[k] = ''; });
        _syncFilterInputs();
        _load();
      },
    };
    return instance;

    // ── Private helpers ───────────────────────────────────────────

    function _initVisibility(cols, cv) {
      const vis = {};
      if (cv.enabled && cv.storageKey) {
        const stored = _loadStorage(cv.storageKey);
        cols.forEach(c => {
          if (c.filterOnly) return;
          vis[c.key] = stored ? (stored[c.key] !== false) : (c.defaultVisible !== false);
        });
      } else {
        cols.forEach(c => {
          if (c.filterOnly) return;
          vis[c.key] = c.defaultVisible !== false;
        });
      }
      return vis;
    }

    function _saveVisibility() {
      if (colVis.enabled && colVis.storageKey) {
        _saveStorage(colVis.storageKey, visibleCols);
      }
    }

    function _loadStorage(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }

    function _saveStorage(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
    }

    function _buildShell(title, actions, cols, pag, bulk, cv) {
      const hasFilters = cols.some(c => c.filter);
      const hasBulk    = bulk.length > 0;
      const hasPager   = pag.enabled;
      const colGroup   = _buildColGroup(cols, hasBulk);

      return `
<div class="dt-wrap">
  ${_buildHeaderBar(title, actions, cv)}
  ${_buildBulkBar(bulk)}
  ${_buildFilterBar(cols, hasFilters)}
  <div class="dt-col-headers">
    <table>${colGroup}<thead><tr id="${containerId}-col-hdr"></tr></thead></table>
  </div>
  <div class="dt-body">
    <table>${colGroup}<tbody id="${containerId}-body"></tbody></table>
  </div>
  <div class="dt-footer${hasPager ? '' : ' dt-hidden'}" id="${containerId}-footer">
    <span class="dt-page-info" id="${containerId}-page-info"></span>
    <div class="dt-pager" id="${containerId}-pager"></div>
    ${hasPager ? _buildLimitSelect(pag) : ''}
  </div>
</div>`;
    }

    function _buildColGroup(cols, hasBulk) {
      let html = hasBulk ? '<col data-col-key="_bulk" style="width:2rem">' : '';
      cols.forEach(c => {
        if (c.filterOnly) return;
        html += c.width
          ? `<col data-col-key="${c.key}" style="width:${c.width}">`
          : `<col data-col-key="${c.key}">`;
      });
      return `<colgroup>${html}</colgroup>`;
    }

    function _buildHeaderBar(title, actions, cv) {
      const actionBtns = actions.map(a => {
        const cls   = a.className || 'btn btn-sm btn-primary';
        const idStr = a.id ? ` id="${a.id}"` : '';
        return `<button class="${cls}"${idStr} onclick="${a.onclick}">${a.label}</button>`;
      }).join('');

      const colVisBtn = cv.enabled
        ? `<div class="dt-col-vis-wrap">
             <button class="btn btn-sm btn-outline-secondary" id="${containerId}-col-vis-btn">⚙ Columns ▼</button>
             <div class="dt-col-vis-dropdown" id="${containerId}-col-vis-dd"></div>
           </div>`
        : '';

      return `
<div class="dt-header-bar">
  <span class="dt-title">${title}</span>
  <div class="dt-actions">${actionBtns}${colVisBtn}</div>
</div>`;
    }

    function _buildBulkBar(bulk) {
      if (!bulk.length) return '';
      const btns = bulk.map(a =>
        `<button class="btn btn-sm btn-danger" data-bulk-action="${_esc(a.label)}">${_esc(a.label)}</button>`
      ).join('');
      return `
<div class="dt-bulk-bar" id="${containerId}-bulk-bar">
  <span class="dt-bulk-count" id="${containerId}-bulk-count"></span>
  ${btns}
</div>`;
    }

    function _buildFilterBar(cols, hasFilters) {
      if (!hasFilters) return `<div class="dt-filter-bar dt-hidden" id="${containerId}-filter-bar"></div>`;
      const mainControls   = cols.filter(c => c.filter && c.filter.type !== 'toggle').map(c => _buildFilterControl(c)).join('');
      const toggleControls = cols.filter(c => c.filter && c.filter.type === 'toggle').map(c => _buildFilterControl(c)).join('');
      return `<div class="dt-filter-bar" id="${containerId}-filter-bar">
        ${mainControls   ? `<div class="dt-filter-main">${mainControls}</div>` : ''}
        ${toggleControls ? `<div class="dt-filter-toggles">${toggleControls}</div>` : ''}
      </div>`;
    }

    function _buildFilterControl(col) {
      const f = col.filter;
      filterState[col.key] = '';
      if (f.type === 'select') {
        return `<div class="dt-filter-control" data-col="${col.key}">
          <select data-filter-key="${col.key}">
            <option value="">${f.placeholder || col.label}</option>
          </select>
        </div>`;
        // options populated by _populateSelectOptions() on each load
      }
      if (f.type === 'text') {
        return `<div class="dt-filter-control" data-col="${col.key}">
          <input type="text" data-filter-key="${col.key}" placeholder="${f.placeholder || col.label}">
        </div>`;
      }
      if (f.type === 'date-range') {
        const ph = f.placeholder || '';
        return `<div class="dt-filter-control" data-col="${col.key}">
          <input type="text" data-filter-key="${col.key}-from" data-date-fmt="${ph}" placeholder="${ph}">
          <input type="text" data-filter-key="${col.key}-to"   data-date-fmt="${ph}" placeholder="${ph}">
        </div>`;
      }
      if (f.type === 'toggle') {
        return `<div class="dt-filter-control" data-col="${col.key}">
          <label><input type="checkbox" data-filter-key="${col.key}"> ${f.placeholder || col.label}</label>
        </div>`;
      }
      return '';
    }

    function _buildLimitSelect(pag) {
      const opts = (pag.limitOptions || [10, 25, 50, 100])
        .map(v => `<option value="${v}"${v === limit ? ' selected' : ''}>${v}/page</option>`)
        .join('');
      return `<select class="dt-limit-select" id="${containerId}-limit">${opts}</select>`;
    }

    function _renderColHeaders() {
      const hasBulk = bulkActions.length > 0;
      const hdr = document.getElementById(`${containerId}-col-hdr`);
      if (!hdr) return;

      let html = hasBulk
        ? `<th style="width:2rem"><input type="checkbox" id="${containerId}-check-all"></th>`
        : '';

      columns.forEach(c => {
        if (c.filterOnly) return;
        const hidden  = visibleCols[c.key] === false ? ' class="dt-col-hidden"' : '';
        const sortable = c.sortable !== false;
        const sortCls = sortable ? ' dt-sortable' : '';
        let indicator = '';
        if (sortable) {
          const isActive = sortState.col === c.key;
          const arrow    = isActive ? (sortState.dir === 'asc' ? '↑' : '↓') : '↕';
          const cls      = isActive ? 'dt-sort-indicator dt-sort-active' : 'dt-sort-indicator';
          indicator = `<span class="${cls}">${arrow}</span>`;
        }
        const alignStyle = c.align ? ` style="text-align:${c.align}"` : '';
        html += `<th${hidden}${alignStyle} class="${sortCls}" data-sort-key="${c.key}">${_esc(c.label)}${indicator}</th>`;
      });

      hdr.innerHTML = html;
    }

    function _renderColVisDropdown() {
      const dd = document.getElementById(`${containerId}-col-vis-dd`);
      if (!dd) return;

      const visCount = Object.values(visibleCols).filter(Boolean).length;
      dd.innerHTML = columns.map(c => {
        const checked   = visibleCols[c.key] !== false;
        const isLast    = checked && visCount === 1;
        return `<label><input type="checkbox" data-vis-key="${c.key}" ${checked ? 'checked' : ''} ${isLast ? 'disabled' : ''}><span>${_esc(c.label)}</span></label>`;
      }).join('');
    }

    function _applyColVisibility() {
      columns.forEach(c => {
        const hidden = visibleCols[c.key] === false;
        // body cells
        document.querySelectorAll(`#${containerId}-body [data-col="${c.key}"]`).forEach(el => {
          el.classList.toggle('dt-col-hidden', hidden);
        });
        // header cell
        const hdrCell = document.querySelector(`#${containerId}-col-hdr [data-sort-key="${c.key}"]`);
        if (hdrCell) hdrCell.classList.toggle('dt-col-hidden', hidden);
        // filter control
        const filterCtrl = document.querySelector(`#${containerId}-filter-bar [data-col="${c.key}"]`);
        if (filterCtrl) {
          filterCtrl.classList.toggle('dt-col-hidden', hidden);
          if (hidden) {
            // reset filter value when column is hidden
            filterCtrl.querySelectorAll('[data-filter-key]').forEach(el => {
              if (el.type === 'checkbox') el.checked = false;
              else el.value = '';
              filterState[el.dataset.filterKey] = '';
            });
          }
        }
      });
    }

    async function _load() {
      const tbody = document.getElementById(`${containerId}-body`);
      if (tbody) tbody.innerHTML = `<tr><td class="dt-empty" colspan="99">Loading…</td></tr>`;

      const params = {
        sort_col:  sortState.col,
        sort_dir:  sortState.dir,
        page,
        limit,
        ...filterState,
      };

      let data = [], total = 0;
      try {
        const result = await fetchData(params);
        data  = result.data  || [];
        total = result.total || data.length;
      } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td class="dt-empty" colspan="99">Error loading data.</td></tr>`;
        console.error('DataTable fetchData error', err);
        return;
      }

      _renderColHeaders();
      _populateSelectOptions();
      _renderBody(data);
      _renderPager(total);
      _applyColVisibility();
      if (colVis.enabled) _renderColVisDropdown();
      if (config.postRender) config.postRender(data);
    }

    function _populateSelectOptions() {
      columns.forEach(col => {
        if (!col.filter || col.filter.type !== 'select' || !col.filter.options) return;
        const sel = container.querySelector(`[data-filter-key="${col.key}"]`);
        if (!sel) return;
        const current = filterState[col.key] || '';
        const rawOpts = typeof col.filter.options === 'function'
          ? col.filter.options(filterState)
          : col.filter.options;
        const opts = rawOpts.map(o =>
          typeof o === 'object'
            ? `<option value="${_esc(o.value)}"${o.value === current ? ' selected' : ''}>${_esc(o.label)}</option>`
            : `<option value="${_esc(o)}"${o === current ? ' selected' : ''}>${_esc(o)}</option>`
        ).join('');
        sel.innerHTML = `<option value="">${col.filter.placeholder || col.label}</option>${opts}`;
      });
    }

    function _renderBody(data) {
      const tbody = document.getElementById(`${containerId}-body`);
      if (!tbody) return;

      if (!data.length) {
        tbody.innerHTML = `<tr><td class="dt-empty" colspan="99">No records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(row => renderRow(row, visibleCols)).join('');
    }

    function _renderPager(total) {
      const footer   = document.getElementById(`${containerId}-footer`);
      const infoEl   = document.getElementById(`${containerId}-page-info`);
      const pagerEl  = document.getElementById(`${containerId}-pager`);
      if (!footer) return;

      if (!pagination.enabled) return;

      const totalPages = Math.max(1, Math.ceil(total / limit));
      const from = Math.min((page - 1) * limit + 1, total);
      const to   = Math.min(page * limit, total);

      if (infoEl) infoEl.textContent = `Rows ${from}–${to} of ${total}`;

      if (!pagerEl) return;
      let html = `<button data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>`;
      for (let p = 1; p <= totalPages; p++) {
        html += `<button data-page="${p}" class="${p === page ? 'dt-page-active' : ''}">${p}</button>`;
      }
      html += `<button data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>`;
      pagerEl.innerHTML = html;
    }

    // Returns a date string in the given workspace format (e.g. YYYY-MM-DD → "2025-01-01")
    function _fmtYearBound(year, month, day, fmt) {
      const sep = /[^A-Z0-9]/i.exec(fmt)?.[0] || '-';
      if (fmt.startsWith('YYYY')) return `${year}${sep}${month}${sep}${day}`;
      if (fmt.startsWith('MM'))   return `${month}${sep}${day}${sep}${year}`;
      return `${day}${sep}${month}${sep}${year}`;
    }

    // Auto-inserts the separator character as the user types digits into a date text input
    function _autoInsertDateSep(input, e) {
      if (!e.inputType?.startsWith('insert')) return;
      const fmt = input.dataset.dateFmt;
      if (!fmt) return;
      const val = input.value;
      for (let i = 0; i < fmt.length; i++) {
        if (!/[A-Z0-9]/i.test(fmt[i]) && i === val.length) {
          input.value = val + fmt[i];
          break;
        }
      }
    }

    function _attachEvents() {
      container.addEventListener('click', e => {
        // Sort header click
        const th = e.target.closest('[data-sort-key]');
        if (th && th.classList.contains('dt-sortable')) {
          const key = th.dataset.sortKey;
          if (sortState.col === key) {
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
          } else {
            sortState.col = key;
            sortState.dir = 'asc';
          }
          page = 1;
          _load();
          return;
        }

        // Pager click
        const pgBtn = e.target.closest('[data-page]');
        if (pgBtn && !pgBtn.disabled) {
          page = parseInt(pgBtn.dataset.page, 10);
          _load();
          return;
        }

        // Bulk action click
        const bulkBtn = e.target.closest('[data-bulk-action]');
        if (bulkBtn) {
          const label  = bulkBtn.dataset.bulkAction;
          const action = bulkActions.find(a => a.label === label);
          if (action) action.onclick([...selectedIds]);
          return;
        }

        // Column visibility toggle button
        const visBtn = e.target.closest(`#${containerId}-col-vis-btn`);
        if (visBtn) {
          const dd = document.getElementById(`${containerId}-col-vis-dd`);
          if (dd) dd.classList.toggle('dt-open');
          return;
        }

        // Close col-vis dropdown on outside click — handled in document listener
      });

      // Filter changes
      container.addEventListener('change', e => {
        const fk = e.target.dataset.filterKey;
        if (fk) {
          const col = columns.find(c => c.filter && c.key === fk);
          if (col?.filter?.setsDateRange && e.target.value) {
            const targetKey = col.filter.setsDateRange;
            const targetCol = columns.find(c => c.key === targetKey);
            const fmt = targetCol?.filter?.placeholder || 'YYYY-MM-DD';
            const year = e.target.value;
            const fromStr = _fmtYearBound(year, '01', '01', fmt);
            const toStr   = _fmtYearBound(year, '12', '31', fmt);
            const fromEl  = container.querySelector(`[data-filter-key="${targetKey}-from"]`);
            const toEl    = container.querySelector(`[data-filter-key="${targetKey}-to"]`);
            if (fromEl) { fromEl.value = fromStr; filterState[`${targetKey}-from`] = fromStr; }
            if (toEl)   { toEl.value   = toStr;   filterState[`${targetKey}-to`]   = toStr;   }
            e.target.value  = '';
            filterState[fk] = '';
            page = 1;
            _load();
            return;
          }
          filterState[fk] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
          page = 1;
          _load();
          return;
        }

        // Limit select
        if (e.target.id === `${containerId}-limit`) {
          limit = parseInt(e.target.value, 10);
          page  = 1;
          _load();
          return;
        }

        // Column visibility checkbox
        const vk = e.target.dataset.visKey;
        if (vk) {
          visibleCols[vk] = e.target.checked;
          _saveVisibility();
          _applyColVisibility();
          _renderColVisDropdown();
          if (!e.target.checked) {
            // hidden column's filter was reset — reload
            page = 1;
            _load();
          }
          return;
        }

        // Select-all checkbox
        if (e.target.id === `${containerId}-check-all`) {
          _toggleSelectAll(e.target.checked);
          return;
        }

        // Row checkbox
        const rowCb = e.target.dataset.rowId;
        if (rowCb !== undefined) {
          e.target.checked ? selectedIds.add(rowCb) : selectedIds.delete(rowCb);
          _updateBulkBar();
          return;
        }
      });

      // Filter text input (debounced)
      let debounceTimer;
      container.addEventListener('input', e => {
        const fk = e.target.dataset.filterKey;
        if (fk && e.target.type === 'text') {
          _autoInsertDateSep(e.target, e);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            filterState[fk] = e.target.value;
            page = 1;
            _load();
          }, 300);
        }
      });

      // Close col-vis dropdown on outside click
      document.addEventListener('click', e => {
        const btn = document.getElementById(`${containerId}-col-vis-btn`);
        const dd  = document.getElementById(`${containerId}-col-vis-dd`);
        if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
          dd.classList.remove('dt-open');
        }
      });
    }

    function _syncFilterInputs() {
      container.querySelectorAll('[data-filter-key]').forEach(el => {
        const key = el.dataset.filterKey;
        if (el.type === 'checkbox') el.checked = !!filterState[key];
        else el.value = filterState[key] || '';
      });
    }

    function _toggleSelectAll(checked) {
      container.querySelectorAll('[data-row-id]').forEach(cb => {
        cb.checked = checked;
        checked ? selectedIds.add(cb.dataset.rowId) : selectedIds.delete(cb.dataset.rowId);
      });
      _updateBulkBar();
    }

    function _updateBulkBar() {
      const bar = document.getElementById(`${containerId}-bulk-bar`);
      if (!bar) return;
      const n = selectedIds.size;
      bar.classList.toggle('dt-visible', n > 0);
      const countEl = document.getElementById(`${containerId}-bulk-count`);
      if (countEl) countEl.textContent = `${n} row${n !== 1 ? 's' : ''} selected`;
    }

    function _esc(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  return { create };
})();
