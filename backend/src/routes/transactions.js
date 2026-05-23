const crypto = require('crypto');
const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

// Returns true if a transaction row satisfies all conditions of a split rule.
function matchesRule(row, rule) {
  return rule.conditions.every(c => {
    const field = c.field;
    const op    = c.operator;
    const val   = c.value;

    if (op === 'in') {
      const ids = Array.isArray(val) ? val : [];
      if (ids.length === 0) return true; // empty = all
      const rowVal = field === 'property_id' ? row.property_id : row.account_id;
      return ids.includes(rowVal);
    }
    if (field === 'amount') {
      const amt = parseFloat(row.amount);
      const cmp = parseFloat(val);
      if (op === 'equals')       return amt === cmp;
      if (op === 'greater_than') return amt > cmp;
      if (op === 'less_than')    return amt < cmp;
    }
    if (field === 'description') {
      const desc = (row.description || '').toLowerCase();
      if (op === 'contains') return desc.includes(String(val).toLowerCase());
      if (op === 'equals')   return desc === String(val).toLowerCase();
    }
    return false;
  });
}

// Computes child transaction rows for a matched rule.
// Percent mode: amounts rounded to 2dp; any rounding remainder added to the last child.
function computeChildren(parentRow, parentId, rule, importBatch, userId, workspaceId) {
  const template  = rule.template;
  const mode      = template[0].amount_type;
  const parentAmt = parseFloat(parentRow.amount);

  let amounts;
  if (mode === 'fixed') {
    amounts = template.map(r => parseFloat(r.amount_value));
  } else {
    const raw = template.map(r => Math.round(parentAmt * parseFloat(r.amount_value)) / 100);
    const allocated = raw.reduce((s, v) => s + v, 0);
    raw[raw.length - 1] = Math.round((raw[raw.length - 1] + (parentAmt - allocated)) * 100) / 100;
    amounts = raw;
  }

  return template.map((r, i) => ({
    workspace_id:           workspaceId,
    parent_transaction_id:  parentId,
    date:                   parentRow.date,
    account_id:             parentRow.account_id || null,
    type:                   r.type,
    category:               r.category,
    amount:                 amounts[i],
    currency:               parentRow.currency.trim().toUpperCase(),
    description:            r.description || null,
    raw_description:        null,
    source:                 parentRow.source || 'import',
    import_batch:           importBatch,
    notes:                  r.notes || null,
    reconciled:             false,
    created_by:             userId,
    last_modified_by:       userId,
  }));
}

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
    const { account_id, property_id, type, category, from, to, search, sort_col, sort_dir, import_batch, reconciled, exclude_children } = req.query;
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
      if (reconciled === 'true')  q = q.where('t.reconciled', true);
      if (reconciled === 'false') q = q.where('t.reconciled', false);
      if (exclude_children)       q = q.whereNull('t.parent_transaction_id');
      return q;
    }

    const baseQuery = db('transactions as t')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .leftJoin('properties as p', function () {
        this.on(db.raw('p.id = COALESCE(t.property_id, ap.property_id)'))
            .andOn('p.workspace_id', 't.workspace_id');
      })
      .where('t.workspace_id', req.workspace_id);

    const [{ count: totalCount }] = await applyFilters(baseQuery.clone()).count('t.id as count');

    const SORT_COLS = { date: 't.date', amount: 't.amount', type: 't.type', category: 't.category', description: 't.description', source: 't.source', property: 'p.name' };
    const sortColumn = SORT_COLS[sort_col] || 't.date';
    const sortDirection = sort_dir === 'asc' ? 'asc' : 'desc';

    const dataQuery = applyFilters(baseQuery.clone())
      .select(
        't.*',
        db.raw('COALESCE(t.property_id, ap.property_id) as property_id'),
        db.raw(
          '(SELECT COUNT(*)::int FROM transactions WHERE parent_transaction_id = t.id AND workspace_id = ?) as split_count',
          [req.workspace_id],
        ),
      )
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

  // Load enabled split rules for this workspace (ordered by created_at — first match wins).
  const splitRules = await db('split_rules')
    .where({ workspace_id, enabled: true })
    .orderBy('created_at', 'asc');

  // Pair each row with the first matching split rule (null if no match).
  const rowRules = rows.map(row => splitRules.find(r => matchesRule(row, r)) || null);
  const autoSplitCount = rowRules.filter(Boolean).length;

  try {
    await db.transaction(async (trx) => {
      for (let i = 0; i < rows.length; i++) {
        const row  = rows[i];
        const rule = rowRules[i];
        const base = {
          workspace_id,
          date:             row.date,
          account_id:       row.account_id  || null,
          type:             row.type,
          category:         row.category,
          amount:           parseFloat(row.amount),
          currency:         row.currency.trim().toUpperCase(),
          description:      row.description     || null,
          raw_description:  row.raw_description || null,
          property_id:      row.property_id     || null,
          source:           row.source          || 'import',
          import_batch,
          notes:            row.notes           || null,
          reconciled:       row.reconciled      || false,
          created_by:       user_id,
          last_modified_by: user_id,
        };

        if (rule) {
          const [parent] = await trx('transactions').insert(base).returning('*');
          const children = computeChildren(row, parent.id, rule, import_batch, user_id, workspace_id);
          await trx('transactions').insert(children);
        } else {
          await trx('transactions').insert(base);
        }
      }
    });

    await req.logger.info('transaction.import.success', {
      inserted: rows.length,
      import_batch,
      auto_split_count: autoSplitCount,
    });
    res.status(201).json({ inserted: rows.length, import_batch, auto_split_count: autoSplitCount });
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
      .groupBy('t.import_batch')
      .select(
        't.import_batch',
        db.raw("MIN(t.source) as source"),
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

// GET /api/transactions/:id
// Returns a single transaction including split_count and parent_transaction_id.
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const tx = await db('transactions as t')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .where({ 't.id': id, 't.workspace_id': req.workspace_id })
      .select(
        't.*',
        db.raw('COALESCE(t.property_id, ap.property_id) as property_id'),
        db.raw(
          '(SELECT COUNT(*)::int FROM transactions WHERE parent_transaction_id = t.id AND workspace_id = ?) as split_count',
          [req.workspace_id],
        ),
      )
      .first();

    if (!tx) {
      await req.logger.debug('transaction.get.notfound', { transaction_id: id });
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await req.logger.info('transaction.get.success', { transaction_id: id });
    res.json(formatDate(tx));
  } catch (err) {
    await req.logger.error('transaction.get.failed', { transaction_id: id, error: err.message });
    console.error('GET /api/transactions/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// GET /api/transactions/:id/splits
// Returns the child transactions of a split parent.
router.get('/:id/splits', requireAuth, async (req, res) => {
  const { id } = req.params;
  const workspace_id = req.workspace_id;

  const parent = await db('transactions').where({ id, workspace_id }).first();
  if (!parent) {
    await req.logger.debug('transaction.splits.get.notfound', { transaction_id: id });
    return res.status(404).json({ error: 'Transaction not found' });
  }

  try {
    const children = await db('transactions as t')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .where({ 't.parent_transaction_id': id, 't.workspace_id': workspace_id })
      .select('t.*', 'ap.property_id')
      .orderBy('t.created_at', 'asc');

    await req.logger.info('transaction.splits.get', { transaction_id: id, child_count: children.length });
    res.json(children.map(c => ({ ...formatDate(c), amount: parseFloat(c.amount) })));
  } catch (err) {
    await req.logger.error('transaction.splits.get.failed', { transaction_id: id, error: err.message });
    console.error('GET /api/transactions/:id/splits error:', err.message);
    res.status(500).json({ error: 'Failed to fetch split children' });
  }
});

// PUT /api/transactions/:id/splits
// Atomically replaces all children of a transaction with a new set of splits.
// Parent must be a root transaction (not itself a child). Children inherit
// date, account_id, currency, import_batch, and source from the parent.
// All child amounts must be positive and sum exactly to the parent amount.
router.put('/:id/splits', requireAuth, async (req, res) => {
  const { id } = req.params;
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  const parent = await db('transactions').where({ id, workspace_id }).first();
  if (!parent) {
    await req.logger.debug('transaction.split.notfound', { transaction_id: id });
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (parent.parent_transaction_id !== null) {
    return res.status(422).json({ error: 'Cannot split a child transaction' });
  }

  const children = req.body;
  if (!Array.isArray(children) || children.length < 2) {
    return res.status(400).json({ error: 'Body must be an array of at least 2 split rows' });
  }

  // Validate each child row
  const rowErrors = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const errs = [];

    if (!child.type || !VALID_TYPES.includes(child.type)) {
      errs.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!child.category) {
      errs.push('category is required');
    } else if (child.type && VALID_TYPES.includes(child.type)) {
      const valid = await db('workspace_enum_values')
        .where({ enum_type: 'transaction_category', type_bucket: child.type, value: child.category, is_active: true })
        .where(function () { this.whereNull('workspace_id').orWhere('workspace_id', workspace_id); })
        .first();
      if (!valid) errs.push(`category '${child.category}' is not valid for type '${child.type}'`);
    }
    const amt = parseFloat(child.amount);
    if (isNaN(amt) || amt <= 0) errs.push('amount must be a positive number');
    if (child.category === 'other_expense' && (!child.notes || !child.notes.trim())) {
      errs.push('notes are required when category is other_expense');
    }

    if (errs.length) rowErrors.push({ row: i, errors: errs });
  }
  if (rowErrors.length) {
    return res.status(422).json({ errors: rowErrors });
  }

  const total = children.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const parentAmount = parseFloat(parent.amount);
  if (Math.abs(total - parentAmount) > 0.005) {
    return res.status(422).json({
      error: `Split amounts must sum to parent amount (${parentAmount}); got ${total.toFixed(2)}`,
    });
  }

  try {
    await req.logger.info('transaction.split.started', { transaction_id: id, child_count: children.length });

    const parentDate = formatDate({ date: parent.date }).date;

    await db.transaction(async (trx) => {
      await trx('transactions').where({ parent_transaction_id: id, workspace_id }).del();
      await trx('transactions').insert(
        children.map(child => ({
          workspace_id,
          parent_transaction_id: id,
          date:             parentDate,
          account_id:       parent.account_id,
          type:             child.type,
          category:         child.category,
          amount:           parseFloat(child.amount),
          currency:         parent.currency,
          description:      child.description || null,
          notes:            child.notes || null,
          import_batch:     parent.import_batch || null,
          source:           parent.source || 'manual',
          reconciled:       false,
          created_by:       user_id,
          last_modified_by: user_id,
        })),
      );
    });

    const updatedParent = await fetchTransactionWithProperty(id, workspace_id);
    const updatedChildren = await db('transactions as t')
      .leftJoin('account_properties as ap', 'ap.account_id', 't.account_id')
      .where({ 't.parent_transaction_id': id, 't.workspace_id': workspace_id })
      .select('t.*', 'ap.property_id');

    await req.logger.info('transaction.split.success', { transaction_id: id, child_count: children.length });
    res.json({
      parent:   formatDate(updatedParent),
      children: updatedChildren.map(formatDate),
    });
  } catch (err) {
    await req.logger.error('transaction.split.failed', { transaction_id: id, error: err.message });
    console.error('PUT /api/transactions/:id/splits error:', err.message);
    res.status(500).json({ error: 'Failed to save transaction splits' });
  }
});

// DELETE /api/transactions/:id/splits
// Removes all children of a transaction, returning it to leaf status.
router.delete('/:id/splits', requireAuth, async (req, res) => {
  const { id } = req.params;
  const workspace_id = req.workspace_id;

  const parent = await db('transactions').where({ id, workspace_id }).first();
  if (!parent) {
    await req.logger.debug('transaction.split.remove.notfound', { transaction_id: id });
    return res.status(404).json({ error: 'Transaction not found' });
  }

  try {
    const deleted = await db('transactions')
      .where({ parent_transaction_id: id, workspace_id })
      .del();

    await req.logger.info('transaction.split.remove', { transaction_id: id, deleted });
    res.json({ deleted });
  } catch (err) {
    await req.logger.error('transaction.split.remove.failed', { transaction_id: id, error: err.message });
    console.error('DELETE /api/transactions/:id/splits error:', err.message);
    res.status(500).json({ error: 'Failed to remove transaction splits' });
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

  // original_date / original_amount: only persist on the first override (ignored if already set)
  if (req.body.original_date !== undefined && existing.original_date === null) {
    updates.original_date = req.body.original_date;
  }
  if (req.body.original_amount !== undefined && existing.original_amount === null) {
    updates.original_amount = parseFloat(req.body.original_amount);
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
