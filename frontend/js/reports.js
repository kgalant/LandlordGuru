// ============================================================
//  REPORTING
//  Filtering, aggregation, and P&L computation.
//  All functions are pure — they take transactions array + params.
// ============================================================

const Reports = (() => {

  // ── Filtering ─────────────────────────────────────────────

  /**
   * Filter transactions by any combination of criteria.
   * All criteria are optional.
   *
   * @param {Array}  txs    Full transactions array
   * @param {Object} opts   Filter options
   * @returns {Array}       Filtered transactions
   */
  function filter(txs, opts = {}) {
    return txs.filter(tx => {
      if (opts.apartment_id && opts.apartment_id !== 'all' && tx.apartment_id !== opts.apartment_id) return false;
      if (opts.type         && opts.type         !== 'all' && tx.type         !== opts.type)         return false;
      if (opts.category     && opts.category     !== 'all' && tx.category     !== opts.category)     return false;
      if (opts.source       && opts.source       !== 'all' && tx.source       !== opts.source)       return false;
      if (opts.reconciled   !== undefined && tx.reconciled !== opts.reconciled)                      return false;
      if (opts.date_from    && tx.date < opts.date_from)                                             return false;
      if (opts.date_to      && tx.date > opts.date_to)                                               return false;
      if (opts.search) {
        const q = opts.search.toLowerCase();
        if (!tx.description.toLowerCase().includes(q) &&
            !tx.notes.toLowerCase().includes(q) &&
            !(tx.category || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // ── Aggregation ───────────────────────────────────────────

  // Sum amounts, grouped by a key function.
  function groupSum(txs, keyFn) {
    const map = {};
    txs.forEach(tx => {
      const k = keyFn(tx);
      map[k] = (map[k] || 0) + tx.amount;
    });
    return map;
  }

  // ── P&L ───────────────────────────────────────────────────

  /**
   * Build a P&L summary for a set of transactions.
   * Currencies are kept separate; a combined DKK-equivalent column
   * is added for cross-currency comparison using CONFIG.FX_RATES.
   *
   * Returns:
   * {
   *   byApartment: { aptId: { income, expenses, net, currency } },
   *   byCategory:  { category: { amount, currency, type } },
   *   totals:      { income_dkk, expenses_dkk, net_dkk }
   * }
   */
  function pnl(txs, apartments) {
    const aptMap = {};
    apartments.forEach(a => {
      aptMap[a.id] = { name: a.name, currency: a.currency, income: 0, expenses: 0 };
    });

    const catMap = {};

    txs.forEach(tx => {
      // Skip deposits and transfers in P&L
      if (tx.type === 'deposit' || tx.type === 'transfer') return;

      const apt = aptMap[tx.apartment_id];
      if (apt) {
        if (tx.type === 'income') apt.income   += tx.amount;
        else                      apt.expenses += tx.amount;
      }

      const catKey  = tx.category || 'uncategorised';
      const catInfo = catMap[catKey] || { amount: 0, count: 0, type: tx.type, currency: tx.currency };
      catInfo.amount += tx.amount;
      catInfo.count  += 1;
      catMap[catKey] = catInfo;
    });

    // Add net and DKK equivalents
    let totalIncomeDKK   = 0;
    let totalExpensesDKK = 0;

    Object.values(aptMap).forEach(apt => {
      apt.net = apt.income - apt.expenses;
      const rate = CONFIG.FX_RATES[apt.currency] || 1;
      totalIncomeDKK   += apt.income   * rate;
      totalExpensesDKK += apt.expenses * rate;
    });

    return {
      byApartment: aptMap,
      byCategory:  catMap,
      totals: {
        income_dkk:   totalIncomeDKK,
        expenses_dkk: totalExpensesDKK,
        net_dkk:       totalIncomeDKK - totalExpensesDKK,
      }
    };
  }

  // ── Monthly income series ─────────────────────────────────

  function monthlyIncome(txs) {
    const income = txs.filter(tx => tx.type === 'income');
    const byMonth = {};
    income.forEach(tx => {
      const ym = tx.date.slice(0, 7); // YYYY-MM
      byMonth[ym] = (byMonth[ym] || 0) + tx.amount;
    });
    return Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  }

  // ── Category breakdown ────────────────────────────────────

  function categoryBreakdown(txs) {
    const map = {};
    txs.forEach(tx => {
      const k = tx.category || 'uncategorised';
      if (!map[k]) map[k] = { category: k, type: tx.type, amount: 0, count: 0, currency: tx.currency };
      map[k].amount += tx.amount;
      map[k].count  += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }

  // ── Format helpers ────────────────────────────────────────

  function fmt(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'DKK', maximumFractionDigits: 0
    }).format(amount);
  }

  function fmtDKK(amount) { return fmt(amount, 'DKK'); }

  function categoryLabel(catKey) {
    for (const group of Object.values(CATEGORIES)) {
      if (group.items[catKey]) return group.items[catKey].label;
    }
    return catKey || '—';
  }

  function typeLabel(typeKey) {
    return CATEGORIES[typeKey]?.label || typeKey || '—';
  }

  return { filter, groupSum, pnl, monthlyIncome, categoryBreakdown, fmt, fmtDKK, categoryLabel, typeLabel };
})();
