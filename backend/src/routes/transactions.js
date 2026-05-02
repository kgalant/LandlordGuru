const crypto = require('crypto');
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
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 10000;

// Resolves the most recent rate for (currency → reportingCurrency) on or before txDate.
async function resolveRate(workspaceId, currency, reportingCurrency, txDate) {
  if (currency === reportingCurrency) {
    return { rate: 1, from_currency: currency, to_currency: reportingCurrency, effective_date: txDate };
  }
  return db('currency_rates')
    .where({ workspace_id: workspaceId, from_currency: currency, to_currency: reportingCurrency })
    .where('effective_date', '<=', txDate)
    .orderBy('effective_date', 'desc')
    .first();
}

// Helper: fetch a single transaction with property_id via JOIN
async function fetchTransactionWithProperty(txId, workspaceId) {
  const [tx] = await db('transactions as t')
    .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
    .where({ 't.id': txId, 't.workspace_id': workspaceId })
    .select('t.*', 'ap.property_id');
  return tx;
}

// Validate fields shared by POST and PATCH.
// Category validity is checked against workspace_enum_values (DB) rather than
// a hardcoded list so that custom categories added via F1-9a are accepted.
async function validateFields(body, workspaceId, requireAll) {
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
    } else if (type && VALID_TYPES.includes(type)) {
      const valid = await db('workspace_enum_values')
        .where('enum_type', 'transaction_category')
        .where('type_bucket', type)
        .where('value', category)
        .where('is_active', true)
        .where(function () {
          this.whereNull('workspace_id').orWhere('workspace_id', workspaceId);
        })
        .first();
      if (!valid) {
        errors.push(`category '${category}' is not valid for type '${type}'`);
      }
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
// Each transaction includes property_id (via account_properties join).
// Optional query params: account_id, property_id, type, category, from, to, search, import_batch, page, limit
router.get('/', requireAuth, async (req, res) => {
  try {
    const { account_id, property_id, type, category, from, to, search, sort_col, sort_dir, import_batch } = req.query;
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT;
    if (page < 1) page = 1;
    if (limit < 1 || limit > MAX_PAGE_LIMIT) limit = DEFAULT_PAGE_LIMIT;

    await req.logger.info('transaction.list.started', {
      filters: { account_id: account_id || null, property_id: property_id || null, type: type || null, category: category || null, from: from || null, to: to || null, search: search || null, import_batch: import_batch || null },
      page,
      limit,
    });

    function applyFilters(q) {
      if (account_id)    q = q.where('t.account_id', account_id);
      if (property_id)   q = q.where(function () { this.where('t.property_id', property_id).orWhere('ap.property_id', property_id); });
      if (type)          q = q.where('t.type', type);
      if (category)      q = q.where('t.category', category);
      if (from)          q = q.where('t.date', '>=', from);
      if (to)            q = q.where('t.date', '<=', to);
      if (search)        q = q.whereILike('t.description', `%${search}%`);
      if (import_batch)  q = q.where('t.import_batch', import_batch);
      return q;
    }

    const baseQuery = db('transactions as t')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .where('t.workspace_id', req.workspace_id);

    const [{ count: totalCount }] = await applyFilters(baseQuery.clone()).count('t.id as count');

    const SORT_COLS = { date: 't.date', amount: 't.amount', type: 't.type', category: 't.category', description: 't.description', source: 't.source', property: 'ap.property_id' };
    const sortColumn = SORT_COLS[sort_col] || 't.date';
    const sortDirection = sort_dir === 'asc' ? 'asc' : 'desc';

    const dataQuery = applyFilters(baseQuery.clone())
      .select('t.*', db.raw('COALESCE(t.property_id, ap.property_id) as property_id'))
      .orderBy(sortColumn, sortDirection)
      .orderBy('t.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const transactions = await dataQuery;
    const total = parseInt(totalCount, 10);

    await req.logger.info('transaction.list.success', { transaction_count: transactions.length, total, page, limit });
    res.json({ data: transactions.map(formatDate), page, limit, total });
  } catch (err) {
    await req.logger.error('transaction.list.failed', { error: err.message });
    console.error('GET /api/transactions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions
router.post('/', requireAuth, async (req, res) => {
  const errors = await validateFields(req.body, req.workspace_id, true);
  if (errors.length) {
    return res.status(422).json({ error: errors.join('; ') });
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

    // Validate currency rate if currency differs from reporting_currency
    const workspace = await db('workspaces').where({ id: workspace_id }).first('reporting_currency');
    const reportingCurrency = workspace.reporting_currency;
    const txCurrency = currency.trim().toUpperCase();
    let resolvedRate = null;
    if (txCurrency !== reportingCurrency) {
      resolvedRate = await resolveRate(workspace_id, txCurrency, reportingCurrency, date);
      if (!resolvedRate) {
        return res.status(422).json({
          error: `No exchange rate found for ${txCurrency} → ${reportingCurrency} on or before ${date}`,
        });
      }
    }

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

    // Fetch with property_id via JOIN
    const txWithProperty = await fetchTransactionWithProperty(tx.id, workspace_id);
    const response = formatDate(txWithProperty);
    if (resolvedRate && resolvedRate.rate !== 1) {
      const rate = parseFloat(resolvedRate.rate);
      response.resolved_rate = rate;
      response.converted_amount = parseFloat((tx.amount * rate).toFixed(2));
      response.reporting_currency = reportingCurrency;
    }

    await req.logger.info('transaction.create.success', {
      transaction_id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
    });
    res.status(201).json(response);
  } catch (err) {
    await req.logger.error('transaction.create.failed', { error: err.message });
    console.error('POST /api/transactions error:', err.message);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// POST /api/transactions/import
// Accepts an array of transaction objects, validates all rows, then inserts
// atomically under a shared import_batch UUID. All-or-nothing: any validation
// failure aborts the entire batch before any row is written.
router.post('/import', requireAuth, async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'Request body must be a non-empty array of transaction objects' });
  }

  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  await req.logger.info('transaction.import.started', { row_count: rows.length });

  // Validate all rows up front; collect per-row errors
  const rowErrors = [];
  for (let i = 0; i < rows.length; i++) {
    const errs = await validateFields(rows[i], workspace_id, true);
    if (errs.length) rowErrors.push({ row: i, errors: errs });
  }
  if (rowErrors.length) {
    return res.status(422).json({ errors: rowErrors });
  }

  // Validate all unique account_ids belong to this workspace in one query
  const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))];
  if (accountIds.length) {
    const validIds = await db('accounts')
      .where('workspace_id', workspace_id)
      .whereIn('id', accountIds)
      .pluck('id');
    const validSet = new Set(validIds);
    const badRows = rows
      .map((r, i) => ({ i, account_id: r.account_id }))
      .filter(({ account_id }) => account_id && !validSet.has(account_id));
    if (badRows.length) {
      return res.status(422).json({
        errors: badRows.map(({ i, account_id }) => ({
          row: i,
          errors: [`account_id ${account_id} not found in this workspace`],
        })),
      });
    }
  }

  // Check currency rates for any non-reporting-currency rows
  const workspace = await db('workspaces').where({ id: workspace_id }).first('reporting_currency');
  const reportingCurrency = workspace.reporting_currency;
  const rateErrors = [];
  for (let i = 0; i < rows.length; i++) {
    const txCurrency = rows[i].currency.trim().toUpperCase();
    if (txCurrency !== reportingCurrency) {
      const rate = await resolveRate(workspace_id, txCurrency, reportingCurrency, rows[i].date);
      if (!rate) {
        rateErrors.push({
          row: i,
          errors: [`No exchange rate found for ${txCurrency} → ${reportingCurrency} on or before ${rows[i].date}`],
        });
      }
    }
  }
  if (rateErrors.length) {
    return res.status(422).json({ errors: rateErrors });
  }

  const import_batch = crypto.randomUUID();

  try {
    await db.transaction(async (trx) => {
      const inserts = rows.map(row => ({
        workspace_id,
        date:             row.date,
        account_id:       row.account_id  || null,
        property_id:      row.property_id || null,
        type:             row.type,
        category:         row.category,
        amount:           parseFloat(row.amount),
        currency:         row.currency.trim().toUpperCase(),
        description:      row.description     || null,
        raw_description:  row.raw_description || null,
        source:           row.source          || 'import',
        import_batch,
        notes:            row.notes           || null,
        reconciled:       row.reconciled      || false,
        created_by:       user_id,
        last_modified_by: user_id,
      }));
      await trx('transactions').insert(inserts);
    });

    await req.logger.info('transaction.import.success', { inserted: rows.length, import_batch });
    res.status(201).json({ inserted: rows.length, import_batch });
  } catch (err) {
    await req.logger.error('transaction.import.failed', { error: err.message });
    console.error('POST /api/transactions/import error:', err.message);
    res.status(500).json({ error: 'Failed to import transactions' });
  }
});

// GET /api/transactions/import/history
// Returns the 10 most recent import batches for this workspace.
router.get('/import/history', requireAuth, async (req, res) => {
  try {
    const batches = await db('transactions as t')
      .where({ 't.workspace_id': req.workspace_id })
      .whereNotNull('t.import_batch')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .leftJoin('properties as p', db.raw(
        'p.id = COALESCE(t.property_id, ap.property_id) AND p.workspace_id = t.workspace_id',
      ))
      .groupBy('t.import_batch', 't.source', 't.created_by')
      .select(
        't.import_batch',
        't.source',
        't.created_by',
        db.raw('COUNT(DISTINCT t.id) as row_count'),
        db.raw('MIN(t.created_at) as imported_at'),
        db.raw("STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) as properties"),
      )
      .orderBy('imported_at', 'desc')
      .limit(10);

    await req.logger.info('transaction.import.history', { batch_count: batches.length });
    res.json(batches.map(b => ({ ...b, row_count: parseInt(b.row_count, 10) })));
  } catch (err) {
    await req.logger.error('transaction.import.history.failed', { error: err.message });
    console.error('GET /api/transactions/import/history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// POST /api/transactions/import/check
// Checks an array of {property_id, date, description, amount} rows against
// existing workspace transactions. Returns array of same length — null (no
// match) or the most-recently-created matching transaction. Read-only and
// idempotent; workspace-scoped.
router.post('/import/check', requireAuth, async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Body must be an array' });
  }

  try {
    const results = await Promise.all(rows.map(async (row) => {
      const { property_id, date, description, amount } = row;
      if (!property_id || !date || description == null || amount == null) return null;

      const match = await db('transactions as t')
        .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
        .where('t.workspace_id', req.workspace_id)
        .whereRaw('COALESCE(t.property_id, ap.property_id) = ?', [property_id])
        .where('t.date', date)
        .whereRaw('LOWER(t.raw_description) = LOWER(?)', [description])
        .where('t.amount', parseFloat(amount))
        .select('t.id', 't.date', 't.description', 't.amount', 't.created_at', 't.import_batch')
        .orderBy('t.created_at', 'desc')
        .first();

      if (!match) return null;
      return formatDate(match);
    }));

    await req.logger.info('transaction.import.check', { row_count: rows.length });
    res.json(results);
  } catch (err) {
    await req.logger.error('transaction.import.check.failed', { error: err.message });
    console.error('POST /api/transactions/import/check error:', err.message);
    res.status(500).json({ error: 'Failed to check for duplicate transactions' });
  }
});

// DELETE /api/transactions/import/:batch_id
// Deletes all transactions belonging to the given import batch in this workspace.
router.delete('/import/:batch_id', requireAuth, async (req, res) => {
  const { batch_id } = req.params;

  try {
    const deleted = await db('transactions')
      .where({ workspace_id: req.workspace_id, import_batch: batch_id })
      .del();

    if (deleted === 0) {
      await req.logger.debug('transaction.import.rollback.notfound', { batch_id });
      return res.status(404).json({ error: 'Import batch not found' });
    }

    await req.logger.info('transaction.import.rollback.success', { batch_id, deleted });
    res.json({ deleted });
  } catch (err) {
    await req.logger.error('transaction.import.rollback.failed', { batch_id, error: err.message });
    console.error('DELETE /api/transactions/import/:batch_id error:', err.message);
    res.status(500).json({ error: 'Failed to roll back import batch' });
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

  const errors = await validateFields(req.body, req.workspace_id, false);
  if (errors.length) {
    return res.status(422).json({ error: errors.join('; ') });
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

  // Validate currency rate if effective currency/date differs from reporting_currency
  const effectiveCurrency = (updates.currency || existing.currency).toUpperCase();
  const effectiveDate = updates.date || existing.date;
  const workspace = await db('workspaces').where({ id: req.workspace_id }).first('reporting_currency');
  const reportingCurrency = workspace.reporting_currency;
  let resolvedRate = null;
  if (effectiveCurrency !== reportingCurrency) {
    const txDate = effectiveDate instanceof Date
      ? effectiveDate.toISOString().slice(0, 10)
      : String(effectiveDate).slice(0, 10);
    resolvedRate = await resolveRate(req.workspace_id, effectiveCurrency, reportingCurrency, txDate);
    if (!resolvedRate) {
      return res.status(422).json({
        error: `No exchange rate found for ${effectiveCurrency} → ${reportingCurrency} on or before ${txDate}`,
      });
    }
  }

  try {
    const [updated] = await db('transactions')
      .where({ id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');

    // Fetch with property_id via JOIN
    const txWithProperty = await fetchTransactionWithProperty(id, req.workspace_id);
    const response = formatDate(txWithProperty);
    if (resolvedRate && resolvedRate.rate !== 1) {
      const rate = parseFloat(resolvedRate.rate);
      response.resolved_rate = rate;
      response.converted_amount = parseFloat((updated.amount * rate).toFixed(2));
      response.reporting_currency = reportingCurrency;
    }

    await req.logger.info('transaction.update.success', {
      transaction_id: updated.id,
      type: updated.type,
      category: updated.category,
    });
    res.json(response);
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
