const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/pnl
// Query params:
//   from, to          - ISO date strings (inclusive range; both optional)
//   property_id       - UUID; filters to transactions on that property
//   account_id        - UUID; filters to that account (and descendants when account_scope=recursive)
//   account_scope     - 'recursive' (default) | 'exact'
//
// Returns income, expenses, and deposits grouped by category+currency in native amounts.
// Transfers (type='transfer') are excluded.
// The client is responsible for FX conversion to reporting currency.
//
// Property filtering matches transactions where:
//   - t.property_id = property_id (directly set on the transaction), OR
//   - t.account_id is linked to the property via account_properties
// Both cases are needed because property_id may be null on older transactions
// that were recorded before migration 018 re-introduced the direct column.
router.get('/pnl', requireAuth, async (req, res) => {
  const workspaceId = req.workspace_id;
  const { from, to, property_id, account_id, account_scope = 'recursive' } = req.query;

  if (from && isNaN(Date.parse(from))) {
    return res.status(400).json({ error: 'from must be a valid ISO date' });
  }
  if (to && isNaN(Date.parse(to))) {
    return res.status(400).json({ error: 'to must be a valid ISO date' });
  }

  const PROP_FILTER = `(t.property_id = ? OR t.account_id IN (SELECT account_id FROM account_properties WHERE property_id = ?))`;

  try {
    let rows;

    if (account_id && account_scope === 'recursive') {
      // CTE params: (accountId, workspaceId, workspaceId) + workspaceId for main WHERE
      const params = [account_id, workspaceId, workspaceId, workspaceId];
      const conditions = [
        't.workspace_id = ?',
        `t.account_id IN (SELECT id FROM account_tree)`,
        `t.type != 'transfer'`,
      ];
      if (property_id) { conditions.push(PROP_FILTER); params.push(property_id, property_id); }
      if (from)        { conditions.push('t.date >= ?'); params.push(from); }
      if (to)          { conditions.push('t.date <= ?'); params.push(to); }

      const result = await db.raw(`
        WITH RECURSIVE account_tree AS (
          SELECT id FROM accounts WHERE id = ? AND workspace_id = ?
          UNION ALL
          SELECT a.id FROM accounts a
          INNER JOIN account_tree ON a.parent_account_id = account_tree.id
          WHERE a.workspace_id = ?
        )
        SELECT t.type, t.category, t.currency, SUM(t.amount)::numeric AS amount
        FROM transactions t
        WHERE ${conditions.join(' AND ')}
        GROUP BY t.type, t.category, t.currency
        ORDER BY t.type, t.category, t.currency
      `, params);
      rows = result.rows;
    } else {
      const params = [workspaceId];
      const conditions = [`t.workspace_id = ?`, `t.type != 'transfer'`];
      if (account_id)  { conditions.push('t.account_id = ?');  params.push(account_id); }
      if (property_id) { conditions.push(PROP_FILTER);          params.push(property_id, property_id); }
      if (from)        { conditions.push('t.date >= ?');         params.push(from); }
      if (to)          { conditions.push('t.date <= ?');         params.push(to); }

      const result = await db.raw(`
        SELECT t.type, t.category, t.currency, SUM(t.amount)::numeric AS amount
        FROM transactions t
        WHERE ${conditions.join(' AND ')}
        GROUP BY t.type, t.category, t.currency
        ORDER BY t.type, t.category, t.currency
      `, params);
      rows = result.rows;
    }

    const toEntry = r => ({ category: r.category, currency: r.currency, amount: parseFloat(r.amount) });
    const income   = rows.filter(r => r.type === 'income').map(toEntry);
    const expenses = rows.filter(r => r.type === 'expense').map(toEntry);
    const deposits = rows.filter(r => r.type === 'deposit').map(toEntry);

    req.logger.info('reports.pnl.success', {
      workspace_id: workspaceId,
      from: from || null,
      to: to || null,
      property_id: property_id || null,
      account_id: account_id || null,
      income_rows: income.length,
      expense_rows: expenses.length,
    });

    return res.json({
      from: from || null,
      to: to || null,
      filters: {
        property_id: property_id || null,
        account_id: account_id || null,
        account_scope: account_id ? account_scope : null,
      },
      income,
      expenses,
      deposits,
    });
  } catch (err) {
    req.logger.error('reports.pnl.error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate P&L report' });
  }
});

module.exports = router;
