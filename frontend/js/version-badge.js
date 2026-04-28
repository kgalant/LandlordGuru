// Version badge + debug panel (F6-6)
// Renders a near-invisible version label in the bottom-right corner of every
// authenticated page. Clicking it opens a debug panel; Escape closes it.

import { decodeToken } from './auth.js';

export function initVersionBadge() {
  if (!window.AUTH_TOKEN) return;

  let _frontend = { version: '…', commit: '…' };
  let _backend  = { version: '…', environment: '…', commit: '…' };
  let _apiMs    = null;
  let _panel    = null;

  // ── Fetch version data ─────────────────────────────────────

  async function _load() {
    const [vj, bj, api] = await Promise.all([
      fetch('version.json').then(r => r.json()).catch(() => ({})),
      fetch('build.json').then(r => r.json()).catch(() => ({})),
      _pingApi(),
    ]);
    _frontend = { version: vj.version || '?', commit: bj.git_commit || vj.build?.git_commit || '?' };
    _backend  = { version: api.version || '?', environment: api.environment || '?', commit: api.commit || '?' };
    _label.textContent = _labelText();
  }

  async function _pingApi() {
    const t0 = Date.now();
    try {
      const data = await fetch('/api/version').then(r => r.json());
      _apiMs = Date.now() - t0;
      return data;
    } catch (_) {
      _apiMs = null;
      return {};
    }
  }

  function _labelText() {
    const commit = (_backend.commit && _backend.commit !== 'unknown')
      ? _backend.commit
      : _frontend.commit;
    return `v${_frontend.version}+${commit}`;
  }

  // ── Label ──────────────────────────────────────────────────

  const _label = document.createElement('button');
  _label.id = 'version-badge';
  _label.textContent = '…';
  Object.assign(_label.style, {
    position: 'fixed', bottom: '8px', right: '10px',
    zIndex: '9990',
    fontSize: '10px',
    background: 'transparent',
    border: 'none',
    padding: '2px 4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    // text colour matches page background — intentionally invisible
    color: '#f7f7f5',
    userSelect: 'none',
  });
  _label.addEventListener('click', _toggle);
  document.body.appendChild(_label);

  _load();

  // ── Panel toggle ───────────────────────────────────────────

  function _toggle() {
    if (!_panel) {
      _buildPanel();
    } else {
      const visible = _panel.style.display !== 'none';
      _panel.style.display = visible ? 'none' : 'block';
      if (!visible) _refreshPanel();
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _panel && _panel.style.display !== 'none') {
      _panel.style.display = 'none';
    }
  });

  // ── Panel build ────────────────────────────────────────────

  function _buildPanel() {
    _panel = document.createElement('div');
    Object.assign(_panel.style, {
      position: 'fixed', bottom: '30px', right: '12px',
      zIndex: '9991',
      width: '320px',
      background: '#ffffff',
      border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '10px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '12px',
      overflow: 'hidden',
    });

    document.body.appendChild(_panel);
    _refreshPanel();
  }

  function _refreshPanel() {
    const payload    = decodeToken(window.AUTH_TOKEN);
    const expiry     = payload?.exp ? _formatTtl(payload.exp) : 'unknown';
    const lastSync   = window.LAST_SYNC ? _formatDate(window.LAST_SYNC) : 'not yet';
    const apiHealth  = _apiMs !== null ? `OK — ${_apiMs} ms` : 'unavailable';

    _panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.08)">
        <span style="font-weight:600;font-size:12px;color:#1a1a18">Debug info</span>
        <button id="vb-close" style="border:none;background:none;cursor:pointer;font-size:15px;color:#8a8a85;padding:0;line-height:1">&#x2715;</button>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">
        ${_row('Frontend',    `${_frontend.version} <span style="font-family:monospace;color:#8a8a85">${_frontend.commit}</span>`)}
        ${_row('Backend',     `${_backend.version} <span style="font-family:monospace;color:#8a8a85">${_backend.commit}</span>`)}
        ${_row('Environment', _backend.environment)}
        ${_row('User',        payload ? `${_esc(payload.name || '?')} &lt;${_esc(payload.email || '?')}&gt;` : 'unknown')}
        ${_row('Workspace',   _esc(String(payload?.workspace_id ?? 'unknown')))}
        ${_row('Token expiry', expiry)}
        ${_row('Last sync',   lastSync)}
        ${_row('API health',  apiHealth)}
      </div>
    `;

    _panel.querySelector('#vb-close').addEventListener('click', () => {
      _panel.style.display = 'none';
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  function _row(label, value) {
    return `
      <div style="display:flex;gap:8px;align-items:baseline">
        <span style="flex:0 0 90px;font-size:10px;color:#8a8a85;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">${_esc(label)}</span>
        <span style="color:#1a1a18;word-break:break-all">${value}</span>
      </div>`;
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _formatTtl(exp) {
    const secs = Math.floor(exp - Date.now() / 1000);
    if (secs <= 0) return 'expired';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h} h ${m} m` : `${m} m`;
  }

  function _formatDate(d) {
    return d instanceof Date ? d.toLocaleTimeString() : String(d);
  }
}
