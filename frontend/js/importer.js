// ============================================================
//  CSV IMPORT PARSER
//  Parses bank statement CSV exports into transaction objects.
//  Column mapping is provided explicitly via colMap — there are
//  no built-in bank profiles.
// ============================================================

import { CATEGORIES } from '../config.js';
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

    // Seed from hints so we have a sensible fallback
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

  function applyRules(description, propertyId, rules) {
    if (!rules || !rules.length) return null;
    const desc = description.toLowerCase();
    const sorted = [...rules].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const rule of sorted) {
      // Scope check: rule matches if it has no property restriction,
      // or if the current row's property is in its property_ids list.
      const scopeMatch =
        !rule.property_ids || rule.property_ids.length === 0 ||
        (propertyId && rule.property_ids.includes(propertyId));
      if (!scopeMatch) continue;
      if (desc.includes(rule.keyword.toLowerCase())) return rule;
    }
    return null;
  }

  // Re-evaluate rules on a single already-parsed row (used when property changes).
  function applyRulesToRow(row, rules) {
    const match = applyRules(row.raw_description || row.description, row.property_id, rules);
    if (match) { row.category = match.category; row._autoMatched = true; }
    return match;
  }

  // ── Main parse function ───────────────────────────────────

  /**
   * Parse a CSV string.
   *
   * @param {string}  csvText     Raw CSV content
   * @param {string}  propertyId  Pre-selected property UUID (or empty string)
   * @param {Array}   rules       Auto-categorisation rules from Api.getRules()
   * @param {Object}  colMap      Column mapping from the mapping panel.
   *                              Shape: { date_col, description_col, amount_col,
   *                                       delimiter, date_format, amount_decimal,
   *                                       currency, skip_rows }
   * @returns {Object} { rows, errors, currency }
   */
  function parseCSV(csvText, propertyId, rules, colMap) {
    const delimiter     = colMap?.delimiter      ?? ',';
    const dateFormat    = colMap?.date_format    ?? 'YYYY-MM-DD';
    const amountDecimal = colMap?.amount_decimal ?? '.';
    const currency      = colMap?.currency       ?? '';
    const skipRows      = colMap?.skip_rows      ?? 1;
    const dateCol       = colMap?.date_col       ?? 0;
    const descCol       = colMap?.description_col ?? 1;
    const amtCol        = colMap?.amount_col     ?? 2;

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

      const match = applyRules(rawDesc, propertyId, rules);

      let autoCategory = match ? match.category : '';

      if (!autoCategory) {
        autoCategory = amount > 0 ? 'rent' : 'other_expense';
      }

      const type = categoryToType(autoCategory);

      // Transfers and deposits keep their original sign so that paired
      // transactions (debit in one account, credit in another) net to zero
      // in the transfers report. Income and expense always use absolute value
      // since their direction is already encoded in the type.
      const storedAmount = (type === 'transfer' || type === 'deposit')
        ? amount
        : Math.abs(amount);

      rows.push({
        date,
        property_id:     propertyId || '',
        type,
        category:        autoCategory,
        amount:          storedAmount,
        currency,
        description:     rawDesc.replace(/^"|"$/g, ''),
        raw_description: rawDesc.replace(/^"|"$/g, ''),
        source:          'import',
        import_batch:    '',
        notes:           '',
        reconciled:      false,
        _sign:           amount >= 0 ? 'credit' : 'debit',
        _rawAmount:      rawAmount.trim(),
        _autoMatched:    !!match,
        _rawLine:        line,
      });
    });

    return { rows, errors, currency };
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
    let html = '';
    if (apiCategories && Object.keys(apiCategories).length > 0) {
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
    } else {
      for (const [typeKey, typeGroup] of Object.entries(CATEGORIES)) {
        html += `<optgroup label="${t('categories.' + typeKey)}">`;
        for (const [catKey] of Object.entries(typeGroup.items)) {
          const sel = catKey === selectedCategory ? ' selected' : '';
          html += `<option value="${catKey}"${sel}>${t('categories.items.' + catKey)}</option>`;
        }
        html += `</optgroup>`;
      }
    }
    html += `<option value="__new__">＋ New category…</option>`;
    return html;
  }

  return {
    parseCSV,
    detectDelimiter,
    detectColumns,
    splitCSVLine,
    categoryToType,
    buildCategoryOptions,
    applyRulesToRow,
  };
})();
