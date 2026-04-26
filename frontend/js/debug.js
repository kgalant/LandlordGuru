// ============================================================
//  DEBUG PANEL + LOGGER
//
//  Activated by ?debug or ?debug=<level> in the URL.
//  Always-on recording: Debug.add() is safe to call regardless.
//  Output is pluggable via transports (screen panel now, log
//  file / remote endpoint later).
//
//  Levels (most severe → most verbose): error > warn > info
//  ?debug        → show all  (defaults to info)
//  ?debug=warn   → warn + error only
//  ?debug=error  → error only
//
//  API
//    Debug.add(section, label, value, level = 'info')
//    Debug.addTransport(fn)   // fn receives each entry object
// ============================================================

import { CONFIG } from '../config.js';

export const Debug = (() => {

  const LEVELS   = { error: 2, warn: 1, info: 0 };
  const COLORS   = { error: '#a32020', warn: '#7a5200', info: '#5a5a55' };
  const BG       = { error: '#fceaea', warn: '#fef3db', info: 'transparent' };
  const ACTIVE_BG   = { error: '#a32020', warn: '#7a5200', info: '#1a1a18' };

  const _entries     = [];   // append-only log (never filtered)
  const _transports  = [];   // output destinations
  let _activeLevel   = 'info';
  let _panel         = null;
  let _ver           = null;
  let _active        = false;

  // ── Helpers ───────────────────────────────────────────────

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Public: record an entry ───────────────────────────────

  function add(section, label, value, level = 'info') {
    const entry = {
      level,
      section,
      label,
      value,
      timestamp: new Date().toISOString(),
    };
    _entries.push(entry);
    _transports.forEach(t => { try { t(entry); } catch (e) {} });
    if (_active && _panel && _panel.style.display !== 'none') _renderBody();
  }

  // ── Public: register an output destination ────────────────
  //  fn(entry) is called for every new entry.
  //  Existing entries are replayed immediately so no history is lost.

  function addTransport(fn) {
    _transports.push(fn);
    _entries.forEach(e => { try { fn(e); } catch (err) {} });
  }

  // ── Init (DOMContentLoaded) ───────────────────────────────

  async function init() {
    const params = new URLSearchParams(location.search);
    if (!params.has('debug')) return;
    _active = true;

    const lvlParam = params.get('debug');
    _activeLevel = (lvlParam && LEVELS[lvlParam] !== undefined) ? lvlParam : 'info';

    try {
      const r = await fetch('version.json');
      _ver = await r.json();
    } catch (e) {
      _ver = { version: 'unknown', date: '' };
    }

    add('App', 'Version',    _ver.version,     'info');
    add('App', 'Build date', _ver.date,         'info');
    add('App', 'Page',       location.pathname, 'info');

    if (CONFIG) {
      add('Config', 'Spreadsheet ID',  CONFIG.SPREADSHEET_ID,       'info');
      add('Config', 'Service account', CONFIG.SERVICE_ACCOUNT_EMAIL, 'info');
      add('Config', 'Key URL',         CONFIG.KEY_FETCHER_URL,       'info');
    }

    add('Runtime', 'Loaded at',  new Date().toISOString(), 'info');
    add('Runtime', 'User agent', navigator.userAgent,      'info');

    _createBadge();
  }

  // ── Badge ─────────────────────────────────────────────────

  function _createBadge() {
    const badge = document.createElement('button');
    badge.id = 'debug-badge';
    _styleBadge(badge);
    badge.addEventListener('click', _togglePanel);
    document.body.appendChild(badge);
  }

  function _styleBadge(badge) {
    badge = badge || document.getElementById('debug-badge');
    if (!badge) return;
    badge.textContent = `v${_ver?.version ?? '?'} · ${_activeLevel}`;
    Object.assign(badge.style, {
      position: 'fixed', bottom: '12px', right: '12px',
      zIndex: '9997',
      fontSize: '11px', padding: '4px 10px',
      borderRadius: '20px',
      border: `0.5px solid ${_activeLevel === 'info' ? 'rgba(0,0,0,0.18)' : COLORS[_activeLevel]}`,
      background: _activeLevel === 'info' ? '#efefeb' : BG[_activeLevel],
      color: COLORS[_activeLevel],
      cursor: 'pointer', fontFamily: 'inherit',
    });
  }

  // ── Panel ─────────────────────────────────────────────────

  function _togglePanel() {
    if (!_panel) {
      _buildPanel();
    } else {
      _panel.style.display = _panel.style.display === 'none' ? 'flex' : 'none';
    }
  }

  function _buildPanel() {
    _panel = document.createElement('div');
    Object.assign(_panel.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      height: '300px',
      background: '#ffffff',
      borderTop: '1px solid rgba(0,0,0,0.12)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      zIndex: '9996',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });

    // Header
    const hdr = document.createElement('div');
    Object.assign(hdr.style, {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px',
      borderBottom: '0.5px solid rgba(0,0,0,0.10)',
      flexShrink: '0',
    });

    hdr.innerHTML = `
      <span style="font-weight:600;font-size:13px;flex-shrink:0">LandlordGuru &mdash; debug</span>
      <div id="debug-level-btns" style="display:flex;gap:5px;margin-right:auto"></div>
      <button id="debug-close" style="border:none;background:none;cursor:pointer;font-size:16px;color:#8a8a85;padding:0 4px;line-height:1">&#x2715;</button>
    `;

    hdr.querySelector('#debug-close').addEventListener('click', () => {
      _panel.style.display = 'none';
    });

    _panel.appendChild(hdr);

    // Body
    const body = document.createElement('div');
    body.id = 'debug-panel-body';
    Object.assign(body.style, {
      overflowY: 'auto', flex: '1',
      padding: '14px 16px',
      display: 'flex', gap: '16px', flexWrap: 'wrap', alignContent: 'flex-start',
    });
    _panel.appendChild(body);

    document.body.appendChild(_panel);
    _renderLevelButtons();
    _renderBody();
  }

  function _renderLevelButtons() {
    const container = document.getElementById('debug-level-btns');
    if (!container) return;
    container.innerHTML = '';
    ['info', 'warn', 'error'].forEach(l => {
      const btn = document.createElement('button');
      btn.textContent = l;
      const isActive = l === _activeLevel;
      Object.assign(btn.style, {
        fontSize: '11px', padding: '3px 10px',
        borderRadius: '20px',
        border: `0.5px solid ${isActive ? ACTIVE_BG[l] : 'rgba(0,0,0,0.18)'}`,
        background: isActive ? ACTIVE_BG[l] : 'transparent',
        color: isActive ? '#fff' : '#8a8a85',
        cursor: 'pointer', fontFamily: 'inherit',
      });
      btn.addEventListener('click', () => {
        _activeLevel = l;
        _styleBadge();
        _renderLevelButtons();
        _renderBody();
      });
      container.appendChild(btn);
    });
  }

  function _renderBody() {
    const body = document.getElementById('debug-panel-body');
    if (!body) return;

    // Filter by active level, then deduplicate per section+label (last write wins)
    const sections = new Map();
    _entries
      .filter(e => LEVELS[e.level] >= LEVELS[_activeLevel])
      .forEach(e => {
        if (!sections.has(e.section)) sections.set(e.section, new Map());
        sections.get(e.section).set(e.label, e);  // last write wins
      });

    if (sections.size === 0) {
      body.innerHTML = `<p style="color:#8a8a85;font-size:12px;padding:8px">No entries at <strong>${_activeLevel}</strong> level or above.</p>`;
      return;
    }

    body.innerHTML = [...sections.entries()].map(([section, labelsMap]) => `
      <div style="background:#f7f7f5;border:0.5px solid rgba(0,0,0,0.10);border-radius:8px;padding:12px 14px;min-width:200px;align-self:flex-start">
        <div style="font-size:10px;font-weight:600;color:#8a8a85;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">${_esc(section)}</div>
        <table style="border-collapse:collapse">
          ${[...labelsMap.values()].map(({ label, value, level }) => `
            <tr>
              <td style="font-size:11px;color:#5a5a55;padding:2px 12px 2px 0;white-space:nowrap;vertical-align:top">${_esc(label)}</td>
              <td style="font-size:12px;font-family:monospace;word-break:break-all;padding:2px 0;vertical-align:top;color:${COLORS[level]};background:${BG[level]}">${_esc(String(value ?? ''))}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { add, addTransport };

})();
