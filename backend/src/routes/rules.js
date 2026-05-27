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

  if (body.sort_order !== undefined && body.sort_order !== null) {
    const order = parseInt(body.sort_order, 10);
    if (isNaN(order)) {
      errors.push('sort_order must be an integer or null');
    }
  }

  return errors;
}

// Attach property_ids arrays to a list of rules.
async function attachPropertyIds(rules) {
  if (!rules.length) return rules;
  const ruleIds = rules.map(r => r.id);
  const links = await db('rule_properties').whereIn('rule_id', ruleIds);
  const byRule = {};
  links.forEach(l => {
    if (!byRule[l.rule_id]) byRule[l.rule_id] = [];
    byRule[l.rule_id].push(l.property_id);
  });
  return rules.map(r => ({ ...r, property_ids: byRule[r.id] || [] }));
}

// Validate that all property_ids belong to the workspace.
async function validatePropertyIds(propertyIds, workspaceId) {
  if (!propertyIds || !propertyIds.length) return null;
  for (const pid of propertyIds) {
    if (typeof pid !== 'string' || !pid.trim()) {
      return 'property_ids must be an array of UUIDs';
    }
    const prop = await db('properties').where({ id: pid, workspace_id: workspaceId }).first();
    if (!prop) return `property_id ${pid} not found in this workspace`;
  }
  return null;
}

// GET /api/rules
// Returns all rules for the workspace with their property_ids arrays.
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('rule.list.started', {});

    const rules = await db('rules')
      .where('workspace_id', req.workspace_id)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');

    const withProps = await attachPropertyIds(rules);

    await req.logger.info('rule.list.success', { rule_count: withProps.length });
    res.json(withProps);
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

  const { keyword, category, sort_order, property_ids } = req.body;
  const workspace_id = req.workspace_id;
  const user_id = req.user.id;

  // Validate property_ids
  const propErr = await validatePropertyIds(property_ids, workspace_id);
  if (propErr) return res.status(400).json({ error: propErr });

  try {
    await req.logger.info('rule.create.started', {
      keyword: keyword.trim(),
      category,
      property_ids: property_ids || [],
    });

    const [rule] = await db('rules')
      .insert({
        workspace_id,
        keyword:          keyword.trim(),
        category,
        sort_order:       sort_order !== undefined ? parseInt(sort_order, 10) : 0,
        created_by:       user_id,
        last_modified_by: user_id,
      })
      .returning('*');

    // Insert property associations
    if (property_ids && property_ids.length) {
      await db('rule_properties').insert(
        property_ids.map(pid => ({ rule_id: rule.id, property_id: pid }))
      );
    }

    await req.logger.info('rule.create.success', {
      rule_id: rule.id,
      keyword: rule.keyword,
      category: rule.category,
    });

    res.status(201).json({ ...rule, property_ids: property_ids || [] });
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

  const allowed = ['keyword', 'category', 'sort_order'];
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

    const [withProps] = await attachPropertyIds([updated]);

    await req.logger.info('rule.update.success', {
      rule_id: updated.id,
      keyword: updated.keyword,
      category: updated.category,
    });
    res.json(withProps);
  } catch (err) {
    await req.logger.error('rule.update.failed', { rule_id: id, error: err.message });
    console.error('PATCH /api/rules/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// PUT /api/rules/:id/properties
// Atomically replace the property associations for a rule.
router.put('/:id/properties', requireAuth, async (req, res) => {
  const { id } = req.params;

  const existing = await db('rules')
    .where({ id, workspace_id: req.workspace_id })
    .first();

  if (!existing) {
    await req.logger.debug('rule.setProperties.notfound', { rule_id: id });
    return res.status(404).json({ error: 'Rule not found' });
  }

  const { property_ids } = req.body;
  if (!Array.isArray(property_ids)) {
    return res.status(400).json({ error: 'property_ids must be an array' });
  }

  const propErr = await validatePropertyIds(property_ids, req.workspace_id);
  if (propErr) return res.status(400).json({ error: propErr });

  try {
    await db.transaction(async (trx) => {
      await trx('rule_properties').where('rule_id', id).del();
      if (property_ids.length) {
        await trx('rule_properties').insert(
          property_ids.map(pid => ({ rule_id: id, property_id: pid }))
        );
      }
    });

    const [withProps] = await attachPropertyIds([existing]);
    // Re-fetch property_ids from DB after the transaction
    const links = await db('rule_properties').where('rule_id', id);
    withProps.property_ids = links.map(l => l.property_id);

    await req.logger.info('rule.setProperties.success', { rule_id: id, property_ids });
    res.json(withProps);
  } catch (err) {
    await req.logger.error('rule.setProperties.failed', { rule_id: id, error: err.message });
    console.error('PUT /api/rules/:id/properties error:', err.message);
    res.status(500).json({ error: 'Failed to update rule properties' });
  }
});

// DELETE /api/rules/:id
// Hard delete — removes the record entirely (cascade handles rule_properties)
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
