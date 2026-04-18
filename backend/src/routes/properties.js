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
router.get('/', requireAuth, async (req, res) => {
  try {
    const properties = await db('properties')
      .where({ workspace_id: req.workspace_id, active: true })
      .orderBy('name', 'asc');

    res.json(properties);
  } catch (err) {
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
    const result = await db.transaction(async (trx) => {
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

      return property;
    });

    res.status(201).json(result);
  } catch (err) {
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

  updates.last_modified_at = new Date();
  updates.last_modified_by = req.user.id;

  try {
    const [updated] = await db('properties')
      .where({ id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');

    res.json(updated);
  } catch (err) {
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
    return res.status(404).json({ error: 'Property not found' });
  }

  try {
    await db('properties')
      .where({ id, workspace_id: req.workspace_id })
      .update({
        active: false,
        last_modified_at: new Date(),
        last_modified_by: req.user.id,
      });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/properties/:id error:', err.message);
    res.status(500).json({ error: 'Failed to archive property' });
  }
});

module.exports = router;
