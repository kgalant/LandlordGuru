const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_MODELS = ['longterm', 'airbnb'];

// Validate fields shared by POST and PATCH
function validateFields(body, requireAll) {
  const errors = [];

  if (requireAll || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }
  if (requireAll || body.country !== undefined) {
    if (!body.country || typeof body.country !== 'string' || body.country.trim().length !== 2) {
      errors.push('country must be a 2-character ISO code');
    }
  }
  if (requireAll || body.currency !== undefined) {
    if (!body.currency || typeof body.currency !== 'string' || body.currency.trim().length !== 3) {
      errors.push('currency must be a 3-character ISO code');
    }
  }
  if (requireAll || body.model !== undefined) {
    if (!body.model || !VALID_MODELS.includes(body.model)) {
      errors.push(`model must be one of: ${VALID_MODELS.join(', ')}`);
    }
  }
  if (body.rent !== undefined && body.rent !== null) {
    if (isNaN(parseFloat(body.rent)) || parseFloat(body.rent) < 0) {
      errors.push('rent must be a non-negative number');
    }
  }
  if (body.aconto !== undefined && body.aconto !== null) {
    if (isNaN(parseFloat(body.aconto)) || parseFloat(body.aconto) < 0) {
      errors.push('aconto must be a non-negative number');
    }
  }

  return errors;
}

// GET /api/properties
// Returns all active properties in the workspace, sorted by name
// Each property includes its linked account_id (via account_properties)
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('property.list.started');

    const properties = await db('properties as p')
      .leftJoin('account_properties as ap', 'ap.property_id', 'p.id')
      .where({ 'p.workspace_id': req.workspace_id, 'p.active': true })
      .select('p.*', 'ap.account_id')
      .orderBy('p.name', 'asc');

    await req.logger.info('property.list.success', { property_count: properties.length });
    res.json(properties);
  } catch (err) {
    await req.logger.error('property.list.failed', { error: err.message });
    console.error('GET /api/properties error:', err.message);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// POST /api/properties
// Creates a property, then auto-creates a matching account and links them
router.post('/', requireAuth, async (req, res) => {
  const errors = validateFields(req.body, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const { name, address, country, currency, model, rent, aconto, tenant, lease_start, notes } = req.body;
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  try {
    await req.logger.info('property.create.started', {
      name: name.trim(),
      country: country.trim(),
      model,
    });

    let resultWithAccount;
    await db.transaction(async (trx) => {
      // 1. Insert property
      const [property] = await trx('properties')
        .insert({
          workspace_id,
          name: name.trim(),
          address: address || null,
          country: country.trim().toUpperCase(),
          currency: currency.trim().toUpperCase(),
          model,
          rent: rent != null ? parseFloat(rent) : null,
          aconto: aconto != null ? parseFloat(aconto) : null,
          tenant: tenant || null,
          lease_start: lease_start || null,
          notes: notes || null,
          active: true,
          created_by: user_id,
          last_modified_by: user_id,
        })
        .returning('*');

      // 2. Auto-create a matching account for this property
      const [account] = await trx('accounts')
        .insert({
          workspace_id,
          name: name.trim(),
          active: true,
          is_default: false,
          created_by: user_id,
          last_modified_by: user_id,
        })
        .returning('*');

      // 3. Link the account to the property
      await trx('account_properties').insert({
        account_id: account.id,
        property_id: property.id,
      });

      resultWithAccount = { ...property, account_id: account.id };
    });

    await req.logger.info('property.create.success', {
      property_id: resultWithAccount.id,
      name: resultWithAccount.name,
      country: resultWithAccount.country,
    });
    res.status(201).json(resultWithAccount);
  } catch (err) {
    await req.logger.error('property.create.failed', { error: err.message });
    console.error('POST /api/properties error:', err.message);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// PATCH /api/properties/:id
// Updates any field on a property (partial update)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  // Verify property exists and belongs to this workspace
  const existing = await db('properties')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('property.update.notfound', { property_id: id });
    return res.status(404).json({ error: 'Property not found' });
  }

  const errors = validateFields(req.body, false);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  // Build update object from only the fields provided
  const allowed = ['name', 'address', 'country', 'currency', 'model', 'rent', 'aconto', 'tenant', 'lease_start', 'notes', 'active'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (updates.name) updates.name = updates.name.trim();
  if (updates.country) updates.country = updates.country.trim().toUpperCase();
  if (updates.currency) updates.currency = updates.currency.trim().toUpperCase();
  if (updates.rent != null) updates.rent = parseFloat(updates.rent);
  if (updates.aconto != null) updates.aconto = parseFloat(updates.aconto);

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  await req.logger.info('property.update.started', {
    property_id: id,
    fields_updated: Object.keys(updates).filter(k => k !== 'last_modified_at' && k !== 'last_modified_by'),
  });

  updates.last_modified_at = new Date();
  updates.last_modified_by = req.user.id;

  try {
    const [updated] = await db('properties')
      .where({ id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');

    // Fetch account_id via LEFT JOIN
    const [withAccount] = await db('properties as p')
      .leftJoin('account_properties as ap', 'ap.property_id', 'p.id')
      .where({ 'p.id': id, 'p.workspace_id': req.workspace_id })
      .select('p.*', 'ap.account_id');

    await req.logger.info('property.update.success', {
      property_id: updated.id,
      name: updated.name,
    });
    res.json(withAccount);
  } catch (err) {
    await req.logger.error('property.update.failed', { property_id: id, error: err.message });
    console.error('PATCH /api/properties/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// DELETE /api/properties/:id
// Soft-delete: sets active = false; preserves transaction history
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('properties')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('property.delete.notfound', { property_id: id });
    return res.status(404).json({ error: 'Property not found' });
  }

  try {
    await req.logger.info('property.archive.started', {
      property_id: id,
      property_name: existing.name,
    });

    await db('properties')
      .where({ id, workspace_id: req.workspace_id })
      .update({
        active: false,
        last_modified_at: new Date(),
        last_modified_by: req.user.id,
      });

    await req.logger.info('property.archive.success', { property_id: id });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('property.archive.failed', { property_id: id, error: err.message });
    console.error('DELETE /api/properties/:id error:', err.message);
    res.status(500).json({ error: 'Failed to archive property' });
  }
});

module.exports = router;
