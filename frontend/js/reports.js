// ============================================================
//  REPORTING
//  Filtering, aggregation, and P&L computation.
//  All functions are pure — they take transactions array + params.
// ============================================================

import { CONFIG, CATEGORIES } from '../config.js';
import { t } from './strings.js';

export const Reports = (() => {

  // ── Filtering ─────────────────────────────────────────────

  function filter(txs, opts = {}) {
    return txs.filter(tx => {
      if (opts.property_id && opts.property_id !== 'all' && tx.property_id !== opts.property_id) return false;
      if (opts.type        && opts.type        !== 'all' && tx.type        !== opts.type)        return false;
      if (opts.category    && opts.category    !== 'all' && tx.category    !== opts.category)    return false;
      if (opts.source      && opts.source      !== 'all' && tx.source      !== opts.source)      return false;
      if (opts.reconciled  !== undefined && tx.reconciled !== opts.reconciled)                   return false;
      if (opts.date_from   && tx.date < opts.date_from)                                          return false;
      if (opts.date_to     && tx.date > opts.date_to)                                            return false;
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

  function groupSum(txs, keyFn) {
    const map = {};
    txs.forEach(tx => {
      const k = keyFn(tx);
      map[k] = (map[k] || 0) + tx.amount;
    });
    return map;
  }

  // ── P&L ───────────────────────────────────────────────────

  function pnl(txs, properties) {
    const propMap = {};
    properties.forEach(p => {
      propMap[p.id] = { name: p.name, currency: p.currency, income: 0, expenses: 0 };
    });

    const catMap = {};

    txs.forEach(tx => {
      if (tx.type === 'deposit' || tx.type === 'transfer') return;

      const prop = propMap[tx.property_id];
      if (prop) {
        if (tx.type === 'income') prop.income   += tx.amount;
        else                      prop.expenses += tx.amount;
      }

      const catKey  = tx.category || 'uncategorised';
      const catInfo = catMap[catKey] || { amount: 0, count: 0, type: tx.type, currency: tx.currency };
      catInfo.amount += tx.amount;
      catInfo.count  += 1;
      catMap[catKey] = catInfo;
    });

    let totalIncomeDKK   = 0;
    let totalExpensesDKK = 0;

    Object.values(propMap).forEach(prop => {
      prop.net = prop.income - prop.expenses;
      const rate = CONFIG.FX_RATES[prop.currency] || 1;
      totalIncomeDKK   += prop.income   * rate;
      totalExpensesDKK += prop.expenses * rate;
    });

    return {
      byProperty: propMap,
      byCategory: catMap,
      totals: {
        income_dkk:   totalIncomeDKK,
        expenses_dkk: totalExpensesDKK,
        net_dkk:      totalIncomeDKK - totalExpensesDKK,
      },
    };
  }

  // ── Monthly income series ─────────────────────────────────

  function monthlyIncome(txs) {
    const income  = txs.filter(tx => tx.type === 'income');
    const byMonth = {};
    income.forEach(tx => {
      const ym = tx.date.slice(0, 7);
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
      style: 'currency', currency: currency || 'DKK',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  }

  function fmtDKK(amount) { return fmt(amount, 'DKK'); }

  // apiCategories: optional flat array from State.transactionCategories (all buckets merged)
  function categoryLabel(catKey, apiCategories) {
    if (apiCategories) {
      const found = apiCategories.find(c => c.value === catKey);
      if (found) return found.label;
    }
    const s = t('categories.items.' + catKey);
    if (s !== 'categories.items.' + catKey) return s;
    for (const group of Object.values(CATEGORIES)) {
      if (group.items[catKey]) return group.items[catKey].label;
    }
    return catKey || '—';
  }

  function typeLabel(typeKey) {
    const s = t('categories.' + typeKey);
    if (s !== 'categories.' + typeKey) return s;
    return CATEGORIES[typeKey]?.label || typeKey || '—';
  }

  return { filter, groupSum, pnl, monthlyIncome, categoryBreakdown, fmt, fmtDKK, categoryLabel, typeLabel };
})();
