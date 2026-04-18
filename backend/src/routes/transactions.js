const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// PostgreSQL returns date columns as JS Date objects (midnight local time).
// toISOString() would shift to UTC and produce the wrong date on non-UTC servers.
// Use local date methods to preserve the date as stored.
function formatDate(tx) {
  if (tx && tx.date) {
    const d = new Date(tx.date);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    tx.date = `${yyyy}-${mm}-${dd}`;
  }
  return tx;
}

const VALID_TYPES = ['income', 'expense', 'deposit', 'transfer'];

const VALID_CATEGORIES = {
  income:   ['rent', 'heating_aconto', 'heating_settlement'],
  expense:  ['maintenance_repair', 'property_tax', 'insurance', 'utilities',
             'management_fee', 'advertising', 'professional_fees', 'bank_charges', 'other_expense'],
  deposit:  ['deposit_received', 'deposit_returned'],
  transfer: ['inter_account'],
};

// Validate fields shared by POST and PATCH
function validateFields(body, requireAll) {
  const errors = [];

  if (requireAll || body.date !== undefined) {
    if (!body.date || isNaN(Date.parse(body.date))) {
      errors.push('date is required and must be a valid ISO date');
    }
  }

  const type = body.type;
  if (requireAll || type !== undefined) {
    if (!type || !VALID_TYPES.includes(type)) {
      errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }
  }

  const category = body.category;
  if (requireAll || category !== undefined) {
    if (!category) {
      errors.push('category is required');
    } else if (type && VALID_CATEGORIES[type] && !VALID_CATEGORIES[type].includes(category)) {
      errors.push(`category '${category}' is not valid for type '${type}'`);
    }
  }

  if (requireAll || body.amount !== undefined) {
    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.push('amount must be a positive number');
    }
  }

  if (requireAll || body.currency !== undefined) {
    if (!body.currency || typeof body.currency !== 'string' || body.currency.trim().length !== 3) {
      errors.push('currency must be a 3-character ISO code');
    }
  }

  // notes required when category is other_expense
  if (body.category === 'other_expense') {
    if (!body.notes || !body.notes.trim()) {
      errors.push('notes are required when category is other_expense');
    }
  }

  return errors;
}

// GET /api/transactions
// Returns transactions for the workspace, newest first.
// Optional query params: account_id, type, from (date), to (date)
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('transaction.list.started', {
      filters: {
        account_id: req.query.account_id || null,
        type: req.query.type || null,
        from: req.query.from || null,
        to: req.query.to || null,
      },
    });

    let query = db('transactions')
      .where('workspace_id', req.workspace_id)
      .orderBy('date', 'desc')
      .orderBy('created_at', 'desc');

    if (req.query.account_id) {
      query = query.where('account_id', req.query.account_id);
    }
    if (req.query.type) {
      query = query.where('type', req.query.type);
    }
    if (req.query.from) {
      query = query.where('date', '>=', req.query.from);
    }
    if (req.query.to) {
      query = query.where('date', '<=', req.query.to);
    }

    const transactions = await query;
    await req.logger.info('transaction.list.success', { transaction_count: transactions.length });
    res.json(transactions.map(formatDate));
  } catch (err) {
    await req.logger.error('transaction.list.failed', { error: err.message });
    console.error('GET /api/transactions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions
router.post('/', requireAuth, async (req, res) => {
  const errors = validateFields(req.body, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const {
    date, account_id, type, category, amount, currency,
    description, raw_description, source, import_batch, notes, reconciled,
  } = req.body;

  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  try {
    await req.logger.info('transaction.create.started', {
      date,
      type,
      category,
      amount: parseFloat(amount),
      currency: currency.trim().toUpperCase(),
    });

    // Verify account_id belongs to this workspace (if provided)
    if (account_id) {
      const account = await db('accounts').where({ id: account_id, workspace_id }).first();
      if (!account) {
        return res.status(400).json({ error: 'account_id not found in this workspace' });
      }
    }

    const [tx] = await db('transactions')
      .insert({
        workspace_id,
        date,
        account_id: account_id || null,
        type,
        category,
        amount: parseFloat(amount),
        currency: currency.trim().toUpperCase(),
        description:     description     || null,
        raw_description: raw_description || null,
        source:          source          || 'manual',
        import_batch:    import_batch    || null,
        notes:           notes           || null,
        reconciled:      reconciled      || false,
        created_by:      user_id,
        last_modified_by: user_id,
      })
      .returning('*');

    await req.logger.info('transaction.create.success', {
      transaction_id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
    });
    res.status(201).json(formatDate(tx));
  } catch (err) {
    await req.logger.error('transaction.create.failed', { error: err.message });
    console.error('POST /api/transactions error:', err.message);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PATCH /api/transactions/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('transactions')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('transaction.update.notfound', { transaction_id: id });
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const errors = validateFields(req.body, false);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  // Verify account_id belongs to this workspace (if being changed)
  if (req.body.account_id !== undefined && req.body.account_id !== null) {
    const account = await db('accounts')
      .where({ id: req.body.account_id, workspace_id: req.workspace_id })
      .first();
    if (!account) {
      return res.status(400).json({ error: 'account_id not found in this workspace' });
    }
  }

  const allowed = ['date', 'account_id', 'type', 'category', 'amount', 'currency',
                   'description', 'raw_description', 'source', 'import_batch', 'notes', 'reconciled'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  if (updates.amount !== undefined) updates.amount = parseFloat(updates.amount);
  if (updates.currency) updates.currency = updates.currency.trim().toUpperCase();

  await req.logger.info('transaction.update.started', {
    transaction_id: id,
    fields_updated: Object.keys(updates).filter(k => k !== 'last_modified_at' && k !== 'last_modified_by'),
  });

  updates.last_modified_at = new Date();
  updates.last_modified_by = req.user.id;

  try {
    const [updated] = await db('transactions')
      .where({ id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');

    await req.logger.info('transaction.update.success', {
      transaction_id: updated.id,
      type: updated.type,
      category: updated.category,
    });
    res.json(formatDate(updated));
  } catch (err) {
    await req.logger.error('transaction.update.failed', { transaction_id: id, error: err.message });
    console.error('PATCH /api/transactions/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id
// Hard delete — removes the record entirely (no audit trail needed; import can re-create)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('transactions')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('transaction.delete.notfound', { transaction_id: id });
    return res.status(404).json({ error: 'Transaction not found' });
  }

  try {
    await req.logger.info('transaction.delete.started', {
      transaction_id: id,
      type: existing.type,
      category: existing.category,
      amount: existing.amount,
    });

    await db('transactions').where({ id, workspace_id: req.workspace_id }).del();

    await req.logger.info('transaction.delete.success', { transaction_id: id });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('transaction.delete.failed', { transaction_id: id, error: err.message });
    console.error('DELETE /api/transactions/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
