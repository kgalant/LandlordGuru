// ============================================================
//  CSV IMPORT PARSER
//  Parses bank statement CSV exports into transaction objects.
//  Supports hardcoded bank profiles (config.js) plus user-saved
//  named column mappings stored in localStorage.
// ============================================================

import { BANK_PROFILES, CATEGORIES } from '../config.js';
import { t } from './strings.js';

export const Importer = (() => {

  // ── Date parsing ──────────────────────────────────────────

  function parseDate(str, format) {
    str = (str || '').trim().replace(/"/g, '');
    const sep = str.includes('.') ? '.' : str.includes('/') ? '/' : '-';
    const parts = str.split(sep);
    const f     = format.toUpperCase();

    let d, m, y;

    if (f.startsWith('DD')) {
      [d, m, y] = parts;
    } else if (f.startsWith('MM')) {
      [m, d, y] = parts;
    } else {
      [y, m, d] = parts;
    }

    if (!y || !m || !d) return null;
    y = y.padStart(4, '20');
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ── Amount parsing ────────────────────────────────────────

  function parseAmount(str, decimalChar) {
    if (!str) return null;
    str = str.replace(/"/g, '').trim();
    if (decimalChar === ',') {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  // ── CSV split (respects quoted fields) ───────────────────

  function splitCSVLine(line, delimiter) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // ── Delimiter detection ───────────────────────────────────

  function detectDelimiter(line) {
    const candidates = [';', ',', '\t', '|'];
    const counts = {};
    candidates.forEach(c => { counts[c] = 0; });
    let inQ = false;
    for (const ch of (line || '')) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (!inQ && counts[ch] !== undefined) counts[ch]++;
    }
    let best = ','; let bestCount = -1;
    for (const [c, n] of Object.entries(counts)) {
      if (n > bestCount) { bestCount = n; best = c; }
    }
    return best;
  }

  // ── Column auto-detection ─────────────────────────────────

  const ROLE_PATTERNS = {
    date: [
      'date', 'dato', 'datum', 'fecha', 'data', 'booking date', 'value date',
      'booked', 'booking', 'trans date', 'valuedate', 'transaction date',
      'valuta dato', 'bogføringsdato', 'handelsdatum', 'buchungsdatum',
    ],
    description: [
      'description', 'desc', 'tekst', 'text', 'narration', 'details', 'memo',
      'payee', 'reference', 'ref', 'beskriv', 'posteringstekst', 'fritekst',
      'transaction description', 'trans description', 'tituł', 'tytuł',
      'opis', 'nazwa', 'beneficiary',
    ],
    amount: [
      'amount', 'beloeb', 'beløb', 'beloep', 'sum', 'belob', 'value',
      'beløb (dkk)', 'beloeb (dkk)', 'kwota', 'wartość',
      'transaction amount', 'trans amount', 'net amount',
    ],
  };

  function detectColumns(headers, hints) {
    const result = { date_col: -1, description_col: -1, amount_col: -1 };

    // Seed from profile hints so we have a sensible fallback
    if (hints) {
      if (hints.date_col        !== undefined) result.date_col        = hints.date_col;
      if (hints.description_col !== undefined) result.description_col = hints.description_col;
      if (hints.amount_col      !== undefined) result.amount_col      = hints.amount_col;
    }

    // Try to match by header text; first strong match wins per role
    const claimed = new Set();
    for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
      const colKey = role + '_col';
      for (let i = 0; i < headers.length; i++) {
        if (claimed.has(i)) continue;
        const hl = headers[i].toLowerCase().replace(/["""]/g, '').trim();
        if (patterns.some(p => hl === p || hl.startsWith(p) || p === hl)) {
          result[colKey] = i;
          claimed.add(i);
          break;
        }
      }
      // Second pass: looser substring match if no exact match
      if (result[colKey] === -1 || result[colKey] === (hints && hints[colKey])) {
        for (let i = 0; i < headers.length; i++) {
          if (claimed.has(i)) continue;
          const hl = headers[i].toLowerCase().replace(/["""]/g, '').trim();
          if (patterns.some(p => hl.includes(p))) {
            result[colKey] = i;
            claimed.add(i);
            break;
          }
        }
      }
    }

    return result;
  }

  // ── Rule matching ─────────────────────────────────────────

  function applyRules(description, profileKey, rules) {
    if (!rules || !rules.length) return null;
    const desc = description.toLowerCase();
    const sorted = [...rules].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const rule of sorted) {
      if (rule.bank_profile && rule.bank_profile !== profileKey) continue;
      if (desc.includes(rule.keyword.toLowerCase())) return rule;
    }
    return null;
  }

  // ── Main parse function ───────────────────────────────────

  /**
   * Parse a CSV string.
   *
   * @param {string}  csvText     Raw CSV content
   * @param {string}  profileKey  Key from BANK_PROFILES in config.js
   * @param {string}  propertyId  Pre-selected property (can be overridden by rules)
   * @param {Array}   rules       Auto-categorisation rules from Api.getRules()
   * @param {Object}  [colMap]    Optional explicit column mapping (from mapping panel).
   *                              If provided, overrides the profile's hardcoded indices.
   *                              Shape: { date_col, description_col, amount_col,
   *                                       delimiter, date_format, amount_decimal,
   *                                       currency, skip_rows }
   * @returns {Object} { rows, errors, profileLabel, currency }
   */
  function parseCSV(csvText, profileKey, propertyId, rules, colMap) {
    const profile = BANK_PROFILES[profileKey];
    if (!profile) throw new Error('Unknown bank profile: ' + profileKey);

    const delimiter     = colMap?.delimiter      ?? profile.delimiter;
    const dateFormat    = colMap?.date_format    ?? profile.date_format;
    const amountDecimal = colMap?.amount_decimal ?? profile.amount_decimal;
    const currency      = colMap?.currency       ?? profile.currency ?? '';
    const skipRows      = colMap?.skip_rows      ?? profile.skip_rows;
    const dateCol       = colMap?.date_col       ?? profile.date_col;
    const descCol       = colMap?.description_col ?? profile.description_col;
    const amtCol        = colMap?.amount_col     ?? profile.amount_col;

    const lines    = csvText.split(/\r?\n/).filter(l => l.trim());
    const dataRows = lines.slice(skipRows);

    const rows   = [];
    const errors = [];

    dataRows.forEach((line, lineIdx) => {
      if (!line.trim()) return;
      const cols = splitCSVLine(line, delimiter);

      const rawDate   = cols[dateCol] ?? '';
      const rawDesc   = cols[descCol] ?? '';
      const rawAmount = cols[amtCol]  ?? '';

      const date   = parseDate(rawDate, dateFormat);
      const amount = parseAmount(rawAmount, amountDecimal);

      if (!date) {
        errors.push({ line: lineIdx + 1 + skipRows, reason: 'Could not parse date: ' + rawDate, raw: line });
        return;
      }
      if (amount === null) {
        errors.push({ line: lineIdx + 1 + skipRows, reason: 'Could not parse amount: ' + rawAmount, raw: line });
        return;
      }

      const match = applyRules(rawDesc, profileKey, rules);

      const absAmount  = Math.abs(amount);
      let autoCategory = match ? match.category : '';
      let autoPropId   = (match && match.property_id) ? match.property_id : propertyId;

      if (!autoCategory) {
        autoCategory = amount > 0 ? 'rent' : 'other_expense';
      }

      const type = categoryToType(autoCategory);

      rows.push({
        date,
        property_id:     autoPropId || '',
        type,
        category:        autoCategory,
        amount:          absAmount,
        currency,
        description:     rawDesc.replace(/^"|"$/g, ''),
        raw_description: rawDesc.replace(/^"|"$/g, ''),
        source:          profileKey,
        import_batch:    '',
        notes:           '',
        reconciled:      false,
        _sign:           amount >= 0 ? 'credit' : 'debit',
        _autoMatched:    !!match,
        _rawLine:        line,
      });
    });

    const label = colMap?.name || profile.label;
    return { rows, errors, profileLabel: label, currency };
  }

  // ── Helpers ───────────────────────────────────────────────

  function categoryToType(category, apiCategories) {
    if (apiCategories) {
      for (const [bucket, items] of Object.entries(apiCategories)) {
        if (items.some(item => item.value === category)) return bucket;
      }
    }
    for (const [type, group] of Object.entries(CATEGORIES)) {
      if (group.items[category]) return type;
    }
    return 'expense';
  }

  const BUCKET_ORDER = ['income', 'expense', 'deposit', 'transfer'];

  function buildCategoryOptions(selectedCategory, apiCategories) {
    if (apiCategories && Object.keys(apiCategories).length > 0) {
      let html = '';
      for (const bucket of BUCKET_ORDER) {
        const items = apiCategories[bucket];
        if (!items || items.length === 0) continue;
        html += `<optgroup label="${t('categories.' + bucket)}">`;
        for (const item of items) {
          const sel = item.value === selectedCategory ? ' selected' : '';
          const label = item.label || item.value;
          html += `<option value="${item.value}"${sel}>${label}</option>`;
        }
        html += `</optgroup>`;
      }
      return html;
    }
    let html = '';
    for (const [typeKey, typeGroup] of Object.entries(CATEGORIES)) {
      html += `<optgroup label="${t('categories.' + typeKey)}">`;
      for (const [catKey] of Object.entries(typeGroup.items)) {
        const sel = catKey === selectedCategory ? ' selected' : '';
        html += `<option value="${catKey}"${sel}>${t('categories.items.' + catKey)}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  }

  return {
    parseCSV,
    detectDelimiter,
    detectColumns,
    splitCSVLine,
    categoryToType,
    buildCategoryOptions,
  };
})();
