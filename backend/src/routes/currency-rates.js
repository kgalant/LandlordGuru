const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_SOURCES = ['manual', 'auto'];

function validateCurrencyCode(code, fieldName) {
  if (!code || typeof code !== 'string' || code.trim().length !== 3) {
    return `${fieldName} must be a 3-character ISO 4217 currency code`;
  }
  return null;
}

// GET /api/currency-rates
// Returns all rates for the workspace, grouped by currency pair, ordered by effective_date desc
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('currency_rate.list.started');

    const rates = await db('currency_rates')
      .where({ workspace_id: req.workspace_id })
      .orderBy([
        { column: 'from_currency', order: 'asc' },
        { column: 'to_currency', order: 'asc' },
        { column: 'effective_date', order: 'desc' },
      ])
      .select('*');

    await req.logger.info('currency_rate.list.success', { rate_count: rates.length });
    res.json(rates);
  } catch (err) {
    await req.logger.error('currency_rate.list.failed', { error: err.message });
    console.error('GET /api/currency-rates error:', err.message);
    res.status(500).json({ error: 'Failed to fetch currency rates' });
  }
});

// POST /api/currency-rates
// Creates a rate entry; required: from_currency, to_currency, effective_date, rate
router.post('/', requireAuth, async (req, res) => {
  const { from_currency, to_currency, effective_date, rate, source } = req.body;
  const errors = [];

  const fromErr = validateCurrencyCode(from_currency, 'from_currency');
  if (fromErr) errors.push(fromErr);

  const toErr = validateCurrencyCode(to_currency, 'to_currency');
  if (toErr) errors.push(toErr);

  if (!effective_date) {
    errors.push('effective_date is required');
  } else if (isNaN(Date.parse(effective_date))) {
    errors.push('effective_date must be a valid date');
  }

  if (rate === undefined || rate === null || rate === '') {
    errors.push('rate is required');
  } else if (isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
    errors.push('rate must be a positive number');
  }

  if (source !== undefined && !VALID_SOURCES.includes(source)) {
    errors.push(`source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const fromUpper = from_currency.trim().toUpperCase();
  const toUpper = to_currency.trim().toUpperCase();

  if (fromUpper === toUpper) {
    return res.status(400).json({ error: 'from_currency and to_currency must be different' });
  }

  try {
    await req.logger.info('currency_rate.create.started', {
      from_currency: fromUpper,
      to_currency: toUpper,
      effective_date,
    });

    const [created] = await db('currency_rates')
      .insert({
        workspace_id: req.workspace_id,
        from_currency: fromUpper,
        to_currency: toUpper,
        effective_date,
        rate: parseFloat(rate),
        source: source || 'manual',
        created_by: req.user.id,
      })
      .returning('*');

    await req.logger.info('currency_rate.create.success', {
      rate_id: created.id,
      from_currency: created.from_currency,
      to_currency: created.to_currency,
      effective_date: created.effective_date,
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: `A rate for ${fromUpper}→${toUpper} on ${effective_date} already exists`,
      });
    }
    await req.logger.error('currency_rate.create.failed', { error: err.message });
    console.error('POST /api/currency-rates error:', err.message);
    res.status(500).json({ error: 'Failed to create currency rate' });
  }
});

// DELETE /api/currency-rates/:id
// Removes a rate entry; rejected if no earlier rate exists to cover transactions
// (full orphan-check is deferred to F3-1 when transactions gain currency awareness)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('currency_rates')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('currency_rate.delete.notfound', { rate_id: id });
    return res.status(404).json({ error: 'Currency rate not found' });
  }

  try {
    await req.logger.info('currency_rate.delete.started', {
      rate_id: id,
      from_currency: existing.from_currency,
      to_currency: existing.to_currency,
      effective_date: existing.effective_date,
    });

    await db('currency_rates').where({ id }).delete();

    await req.logger.info('currency_rate.delete.success', { rate_id: id });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('currency_rate.delete.failed', { rate_id: id, error: err.message });
    console.error('DELETE /api/currency-rates/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete currency rate' });
  }
});

module.exports = router;
