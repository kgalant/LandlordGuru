const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = [
  'rent', 'heating_aconto', 'heating_settlement',
  'maintenance_repair', 'property_tax', 'insurance', 'utilities',
  'management_fee', 'advertising', 'professional_fees', 'bank_charges', 'other_expense',
  'deposit_received', 'deposit_returned',
  'inter_account',
];

function validateBody(body, requireAll) {
  const errors = [];

  if (requireAll || body.keyword !== undefined) {
    if (!body.keyword || typeof body.keyword !== 'string' || !body.keyword.trim()) {
      errors.push('keyword is required and must be a non-empty string');
    }
  }

  if (requireAll || body.category !== undefined) {
    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  if (body.bank_profile !== undefined && body.bank_profile !== null && body.bank_profile !== '') {
    if (typeof body.bank_profile !== 'string') {
      errors.push('bank_profile must be a string');
    }
  }

  if (body.property_id !== undefined && body.property_id !== null) {
    if (typeof body.property_id !== 'string' || !body.property_id.trim()) {
      errors.push('property_id must be a valid UUID or null');
    }
  }

  return errors;
}

// GET /api/description-mappings
// Returns all workspace-wide (global) mappings plus the current user's mappings.
router.get('/', requireAuth, async (req, res) => {
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  try {
    await req.logger.info('description_mapping.list.started', { user_id });

    const mappings = await db('description_mappings')
      .where('workspace_id', workspace_id)
      .where(function () {
        this.whereNull('user_id').orWhere('user_id', user_id);
      })
      .orderBy('updated_at', 'desc');

    await req.logger.info('description_mapping.list.success', { count: mappings.length });
    res.json(mappings);
  } catch (err) {
    await req.logger.error('description_mapping.list.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch description mappings' });
  }
});

// POST /api/description-mappings
// Upsert a mapping for the current user by (bank_profile, keyword).
// To create a global (workspace-wide) mapping, pass scope: 'global'.
router.post('/', requireAuth, async (req, res) => {
  const errors = validateBody(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const workspace_id = req.workspace_id;
  const user_id = req.user.id;
  const { keyword, category, property_id, scope } = req.body;
  const bank_profile = req.body.bank_profile !== undefined ? String(req.body.bank_profile) : '';
  const isGlobal = scope === 'global';
  const mappingUserId = isGlobal ? null : user_id;

  try {
    await req.logger.info('description_mapping.upsert.started', {
      keyword: keyword.trim(), category, bank_profile, scope: scope || 'user',
    });

    if (property_id) {
      const property = await db('properties').where({ id: property_id, workspace_id }).first();
      if (!property) return res.status(400).json({ error: 'property_id not found in this workspace' });
    }

    // Find existing row using the appropriate partial index key
    const existing = await db('description_mappings')
      .where({ workspace_id, bank_profile, keyword: keyword.trim() })
      .where(isGlobal ? { user_id: null } : { user_id })
      .first();

    let mapping;
    if (existing) {
      [mapping] = await db('description_mappings')
        .where({ id: existing.id })
        .update({
          category,
          property_id: property_id || null,
          updated_at: new Date(),
          updated_by: user_id,
        })
        .returning('*');
    } else {
      [mapping] = await db('description_mappings')
        .insert({
          workspace_id,
          user_id: mappingUserId,
          bank_profile,
          keyword: keyword.trim(),
          category,
          property_id: property_id || null,
          created_by: user_id,
          updated_by: user_id,
        })
        .returning('*');
    }

    await req.logger.info('description_mapping.upsert.success', {
      mapping_id: mapping.id, keyword: mapping.keyword, category: mapping.category,
    });
    res.status(existing ? 200 : 201).json(mapping);
  } catch (err) {
    await req.logger.error('description_mapping.upsert.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to save description mapping' });
  }
});

// DELETE /api/description-mappings/:id
// Users may only delete their own mappings; workspace owners may delete global ones.
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  const existing = await db('description_mappings')
    .where({ id, workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('description_mapping.delete.notfound', { mapping_id: id });
    return res.status(404).json({ error: 'Mapping not found' });
  }

  // Allow deletion if the mapping belongs to the current user, or is global (user_id IS NULL)
  const canDelete = existing.user_id === null || existing.user_id === user_id;
  if (!canDelete) {
    await req.logger.debug('description_mapping.delete.forbidden', { mapping_id: id });
    return res.status(403).json({ error: 'Cannot delete another user\'s mapping' });
  }

  try {
    await req.logger.info('description_mapping.delete.started', {
      mapping_id: id, keyword: existing.keyword,
    });

    await db('description_mappings').where({ id, workspace_id }).del();

    await req.logger.info('description_mapping.delete.success', { mapping_id: id });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('description_mapping.delete.failed', { mapping_id: id, error: err.message });
    res.status(500).json({ error: 'Failed to delete description mapping' });
  }
});

module.exports = router;
