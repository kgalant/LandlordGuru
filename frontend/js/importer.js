// ============================================================
//  CSV IMPORT PARSER
//  Parses bank statement CSV exports into transaction objects.
//  Supports multiple bank profiles defined in config.js.
// ============================================================

const Importer = (() => {

  // ── Date parsing ──────────────────────────────────────────

  function parseDate(str, format) {
    str = (str || '').trim().replace(/"/g, '');
    // Normalise separators
    const sep = str.includes('.') ? '.' : str.includes('/') ? '/' : '-';
    const parts = str.split(sep);
    const f     = format.toUpperCase();

    let d, m, y;

    if (f.startsWith('DD')) {
      [d, m, y] = parts;
    } else if (f.startsWith('MM')) {
      [m, d, y] = parts;
    } else {
      // YYYY-MM-DD
      [y, m, d] = parts;
    }

    if (!y || !m || !d) return null;
    // Zero-pad
    y = y.padStart(4, '20');
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ── Amount parsing ────────────────────────────────────────

  function parseAmount(str, decimalChar) {
    if (!str) return null;
    str = str.replace(/"/g, '').trim();
    // Remove thousands separator (the opposite of decimal char)
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

  // ── Main parse function ───────────────────────────────────

  /**
   * Parse a CSV string using a named bank profile.
   *
   * @param {string}   csvText      Raw CSV content
   * @param {string}   profileKey   Key from BANK_PROFILES in config.js
   * @param {string}   apartmentId  Pre-selected apartment (can be overridden by rules)
   * @param {Array}    rules        Auto-categorisation rules from DB.getRules()
   * @returns {Object} { rows: [...], errors: [...], profileLabel }
   */
  function parseCSV(csvText, profileKey, apartmentId, rules) {
    const profile = BANK_PROFILES[profileKey];
    if (!profile) throw new Error('Unknown bank profile: ' + profileKey);

    const lines   = csvText.split(/\r?\n/).filter(l => l.trim());
    const dataRows = lines.slice(profile.skip_rows);

    const rows   = [];
    const errors = [];

    dataRows.forEach((line, lineIdx) => {
      if (!line.trim()) return;
      const cols = splitCSVLine(line, profile.delimiter);

      const rawDate   = cols[profile.date_col]        ?? '';
      const rawDesc   = cols[profile.description_col] ?? '';
      const rawAmount = cols[profile.amount_col]      ?? '';

      const date   = parseDate(rawDate, profile.date_format);
      const amount = parseAmount(rawAmount, profile.amount_decimal);

      if (!date) {
        errors.push({ line: lineIdx + 1 + profile.skip_rows, reason: 'Could not parse date: ' + rawDate, raw: line });
        return;
      }
      if (amount === null) {
        errors.push({ line: lineIdx + 1 + profile.skip_rows, reason: 'Could not parse amount: ' + rawAmount, raw: line });
        return;
      }

      // Try to auto-categorise
      const match = DB.applyRules(rawDesc, profileKey, rules);

      // Determine sign semantics:
      // Positive amount = money received (income / deposit)
      // Negative amount = money paid out (expense)
      // We store absolute value and derive type from sign + category
      const absAmount = Math.abs(amount);
      let autoCategory = match ? match.category : '';
      let autoAptId    = (match && match.apartment_id) ? match.apartment_id : apartmentId;

      // If no rule matched, guess from sign
      if (!autoCategory) {
        autoCategory = amount > 0 ? 'rent' : 'other_expense';
      }

      // Derive top-level type from category
      const type = categoryToType(autoCategory);

      rows.push({
        date,
        apartment_id:    autoAptId || '',
        type,
        category:        autoCategory,
        amount:          absAmount,
        currency:        profile.currency || '',
        description:     rawDesc.replace(/^"|"$/g, ''),
        raw_description: rawDesc.replace(/^"|"$/g, ''),
        source:          profileKey,
        import_batch:    '',   // set at save time
        notes:           '',
        reconciled:      false,
        // UI helpers (not saved)
        _sign:           amount >= 0 ? 'credit' : 'debit',
        _autoMatched:    !!match,
        _rawLine:        line,
      });
    });

    return {
      rows,
      errors,
      profileLabel: profile.label,
      currency: profile.currency,
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  function categoryToType(category) {
    for (const [type, group] of Object.entries(CATEGORIES)) {
      if (group.items[category]) return type;
    }
    return 'expense';
  }

  // Build a flat list of all category options for a <select>
  function buildCategoryOptions(selectedCategory) {
    let html = '';
    for (const [typeKey, typeGroup] of Object.entries(CATEGORIES)) {
      html += `<optgroup label="${typeGroup.label}">`;
      for (const [catKey, cat] of Object.entries(typeGroup.items)) {
        const sel = catKey === selectedCategory ? ' selected' : '';
        html += `<option value="${catKey}"${sel}>${cat.label}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  }

  return { parseCSV, categoryToType, buildCategoryOptions };
})();
