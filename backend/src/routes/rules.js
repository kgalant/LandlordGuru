const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Validate fields shared by POST and PATCH.
// Category validity is checked against workspace_enum_values (DB) rather than
// a hardcoded list so that workspace-specific and custom categories are accepted.
async function validateFields(body, requireAll, workspaceId) {
  const errors = [];

  if (requireAll || body.keyword !== undefined) {
    if (!body.keyword || typeof body.keyword !== 'string' || !body.keyword.trim()) {
      errors.push('keyword is required and must be a non-empty string');
    }
  }

  if (requireAll || body.category !== undefined) {
    if (!body.category) {
      errors.push('category is required');
    } else {
      const valid = await db('workspace_enum_values')
        .where('enum_type', 'transaction_category')
        .where('value', body.category)
        .where('is_active', true)
        .where(function () {
          this.whereNull('workspace_id').orWhere('workspace_id', workspaceId);
        })
        .first();
      if (!valid) {
        errors.push(`category "${body.category}" is not a recognised transaction category`);
      }
    }
  }

  if (body.bank_profile !== undefined && body.bank_profile !== null) {
    if (typeof body.bank_profile !== 'string' || !body.bank_profile.trim()) {
      errors.push('bank_profile must be a non-empty string or null');
    }
  }

  if (body.property_id !== undefined && body.property_id !== null) {
    if (typeof body.property_id !== 'string' || !body.property_id.trim()) {
      errors.push('property_id must be a valid UUID or null');
    }
  }

  if (body.sort_order !== undefined && body.sort_order !== null) {
    const order = parseInt(body.sort_order, 10);
    if (isNaN(order)) {
      errors.push('sort_order must be an integer or null');
    }
  }

  return errors;
}

// GET /api/rules
// Returns all rules for the workspace, sorted by sort_order
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('rule.list.started', {
      bank_profile: req.query.bank_profile || null,
    });

    let query = db('rules')
      .where('workspace_id', req.workspace_id)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');

    if (req.query.bank_profile) {
      query = query.where('bank_profile', req.query.bank_profile);
    }

    const rules = await query;
    await req.logger.info('rule.list.success', { rule_count: rules.length });
    res.json(rules);
  } catch (err) {
    await req.logger.error('rule.list.failed', { error: err.message });
    console.error('GET /api/rules error:', err.message);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST /api/rules
router.post('/', requireAuth, async (req, res) => {
  const errors = await validateFields(req.body, true, req.workspace_id);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const { keyword, category, bank_profile, property_id, sort_order } = req.body;
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  try {
    await req.logger.info('rule.create.started', {
      keyword: keyword.trim(),
      category,
      bank_profile: bank_profile || null,
    });

    // Verify property_id belongs to this workspace (if provided)
    if (property_id) {
      const property = await db('properties')
        .where({ id: property_id, workspace_id })
        .first();
      if (!property) {
        return res.status(400).json({ error: 'property_id not found in this workspace' });
      }
    }

    const [rule] = await db('rules')
      .insert({
        workspace_id,
        keyword: keyword.trim(),
        category,
        bank_profile:  bank_profile  ? bank_profile.trim()  : null,
        property_id:   property_id    ? property_id.trim()   : null,
        sort_order:    sort_order !== undefined ? parseInt(sort_order, 10) : 0,
        created_by:    user_id,
        last_modified_by: user_id,
      })
      .returning('*');

    await req.logger.info('rule.create.success', {
      rule_id: rule.id,
      keyword: rule.keyword,
      category: rule.category,
    });
    res.status(201).json(rule);
  } catch (err) {
    await req.logger.error('rule.create.failed', { error: err.message });
    console.error('POST /api/rules error:', err.message);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PATCH /api/rules/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('rules')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('rule.update.notfound', { rule_id: id });
    return res.status(404).json({ error: 'Rule not found' });
  }

  const errors = await validateFields(req.body, false, req.workspace_id);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  // Verify property_id belongs to this workspace (if being changed)
  if (req.body.property_id !== undefined && req.body.property_id !== null) {
    const property = await db('properties')
      .where({ id: req.body.property_id, workspace_id: req.workspace_id })
      .first();
    if (!property) {
      return res.status(400).json({ error: 'property_id not found in this workspace' });
    }
  }

  const allowed = ['keyword', 'category', 'bank_profile', 'property_id', 'sort_order'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  if (updates.keyword) updates.keyword = updates.keyword.trim();
  if (updates.bank_profile) updates.bank_profile = updates.bank_profile.trim();
  if (updates.property_id && updates.property_id !== null) updates.property_id = updates.property_id.trim();
  if (updates.sort_order !== undefined && updates.sort_order !== null) {
    updates.sort_order = parseInt(updates.sort_order, 10);
  }

  await req.logger.info('rule.update.started', {
    rule_id: id,
    fields_updated: Object.keys(updates).filter(k => k !== 'last_modified_at' && k !== 'last_modified_by'),
  });

  updates.last_modified_at = new Date();
  updates.last_modified_by = req.user.id;

  try {
    const [updated] = await db('rules')
      .where({ id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');

    await req.logger.info('rule.update.success', {
      rule_id: updated.id,
      keyword: updated.keyword,
      category: updated.category,
    });
    res.json(updated);
  } catch (err) {
    await req.logger.error('rule.update.failed', { rule_id: id, error: err.message });
    console.error('PATCH /api/rules/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /api/rules/:id
// Hard delete — removes the record entirely
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('rules')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('rule.delete.notfound', { rule_id: id });
    return res.status(404).json({ error: 'Rule not found' });
  }

  try {
    await req.logger.info('rule.delete.started', {
      rule_id: id,
      keyword: existing.keyword,
      category: existing.category,
    });

    await db('rules').where({ id, workspace_id: req.workspace_id }).del();

    await req.logger.info('rule.delete.success', { rule_id: id });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('rule.delete.failed', { rule_id: id, error: err.message });
    console.error('DELETE /api/rules/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

module.exports = router;
