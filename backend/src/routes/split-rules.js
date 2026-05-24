const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES = ['income', 'expense', 'deposit', 'transfer'];
const VALID_CATEGORIES = {
  income:   ['rent', 'heating_aconto', 'heating_settlement'],
  expense:  ['maintenance_repair', 'property_tax', 'insurance', 'utilities',
             'management_fee', 'advertising', 'professional_fees', 'bank_charges', 'other_expense'],
  deposit:  ['deposit_received', 'deposit_returned'],
  transfer: ['inter_account'],
};
const CONDITION_FIELDS = ['account_id', 'property_id', 'amount', 'description'];
const CONDITION_OPS = {
  account_id:  ['in'],
  property_id: ['in'],
  amount:      ['equals', 'greater_than', 'less_than'],
  description: ['contains', 'equals'],
};

function validateConditions(conditions) {
  const errors = [];
  if (!Array.isArray(conditions) || conditions.length === 0) {
    errors.push('conditions must be a non-empty array');
    return errors;
  }
  conditions.forEach((c, i) => {
    if (!CONDITION_FIELDS.includes(c.field)) {
      errors.push(`conditions[${i}].field must be one of: ${CONDITION_FIELDS.join(', ')}`);
      return;
    }
    if (!CONDITION_OPS[c.field].includes(c.operator)) {
      errors.push(`conditions[${i}].operator must be one of: ${CONDITION_OPS[c.field].join(', ')} for field "${c.field}"`);
    }
    if (c.operator === 'in') {
      // array value required; empty array is valid (means "all")
      if (!Array.isArray(c.value)) {
        errors.push(`conditions[${i}].value must be an array for operator "in"`);
      }
    } else {
      if (c.value === undefined || c.value === null || c.value === '') {
        errors.push(`conditions[${i}].value is required`);
      }
      if (c.field === 'amount' && isNaN(parseFloat(c.value))) {
        errors.push(`conditions[${i}].value must be a number for field "amount"`);
      }
    }
  });
  return errors;
}

function validateTemplate(template) {
  const errors = [];
  if (!Array.isArray(template) || template.length < 2) {
    errors.push('template must be an array with at least 2 rows');
    return errors;
  }

  const modes = template.map(r => r.amount_type);
  if (modes.some(m => m !== 'fixed' && m !== 'percent')) {
    errors.push('template rows amount_type must be "fixed" or "percent"');
    return errors;
  }
  if (new Set(modes).size > 1) {
    errors.push('all template rows must use the same amount_type');
    return errors;
  }

  template.forEach((r, i) => {
    if (!VALID_TYPES.includes(r.type)) {
      errors.push(`template[${i}].type must be one of: ${VALID_TYPES.join(', ')}`);
    } else {
      const validCats = VALID_CATEGORIES[r.type] || [];
      if (!r.category || !validCats.includes(r.category)) {
        errors.push(`template[${i}].category "${r.category}" is not valid for type "${r.type}"`);
      }
    }
    const val = parseFloat(r.amount_value);
    if (isNaN(val) || val <= 0) {
      errors.push(`template[${i}].amount_value must be a positive number`);
    }
  });

  if (errors.length === 0 && modes[0] === 'percent') {
    const total = template.reduce((s, r) => s + parseFloat(r.amount_value), 0);
    if (Math.abs(total - 100) > 0.001) {
      errors.push(`template percent values must sum to 100 (got ${total})`);
    }
  }

  return errors;
}

function validateRule(body, requireAll) {
  const errors = [];
  if (requireAll || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required and must be a non-empty string');
    }
  }
  if (requireAll || body.conditions !== undefined) {
    errors.push(...validateConditions(body.conditions));
  }
  if (requireAll || body.template !== undefined) {
    errors.push(...validateTemplate(body.template));
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  return errors;
}

// GET /api/split-rules
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('split_rule.list.started');
    const rules = await db('split_rules')
      .where('workspace_id', req.workspace_id)
      .orderBy('created_at', 'asc');
    await req.logger.info('split_rule.list.success', { count: rules.length });
    res.json(rules);
  } catch (err) {
    await req.logger.error('split_rule.list.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch split rules' });
  }
});

// GET /api/split-rules/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const rule = await db('split_rules')
      .where({ id: req.params.id, workspace_id: req.workspace_id })
      .first();
    if (!rule) return res.status(404).json({ error: 'Split rule not found' });
    res.json(rule);
  } catch (err) {
    await req.logger.error('split_rule.get.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch split rule' });
  }
});

// POST /api/split-rules
router.post('/', requireAuth, async (req, res) => {
  try {
    const errors = validateRule(req.body, true);
    if (errors.length) {
      await req.logger.info('split_rule.create.validation_failed', { errors });
      return res.status(422).json({ errors });
    }

    await req.logger.info('split_rule.create.started', { name: req.body.name });
    const [rule] = await db('split_rules')
      .insert({
        workspace_id: req.workspace_id,
        name: req.body.name.trim(),
        enabled: req.body.enabled !== false,
        conditions: JSON.stringify(req.body.conditions),
        template: JSON.stringify(req.body.template),
        created_by: req.user.id,
      })
      .returning('*');
    await req.logger.info('split_rule.create.success', { id: rule.id });
    res.status(201).json(rule);
  } catch (err) {
    await req.logger.error('split_rule.create.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create split rule' });
  }
});

// PATCH /api/split-rules/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db('split_rules')
      .where({ id: req.params.id, workspace_id: req.workspace_id })
      .first();
    if (!existing) return res.status(404).json({ error: 'Split rule not found' });

    const errors = validateRule(req.body, false);
    if (errors.length) {
      await req.logger.info('split_rule.update.validation_failed', { id: req.params.id, errors });
      return res.status(422).json({ errors });
    }

    await req.logger.info('split_rule.update.started', { id: req.params.id });
    const updates = {};
    if (req.body.name !== undefined)       updates.name = req.body.name.trim();
    if (req.body.enabled !== undefined)    updates.enabled = req.body.enabled;
    if (req.body.conditions !== undefined) updates.conditions = JSON.stringify(req.body.conditions);
    if (req.body.template !== undefined)   updates.template = JSON.stringify(req.body.template);

    const [rule] = await db('split_rules')
      .where({ id: req.params.id, workspace_id: req.workspace_id })
      .update(updates)
      .returning('*');
    await req.logger.info('split_rule.update.success', { id: rule.id });
    res.json(rule);
  } catch (err) {
    await req.logger.error('split_rule.update.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update split rule' });
  }
});

// DELETE /api/split-rules/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db('split_rules')
      .where({ id: req.params.id, workspace_id: req.workspace_id })
      .first();
    if (!existing) return res.status(404).json({ error: 'Split rule not found' });

    await req.logger.info('split_rule.delete.started', { id: req.params.id });
    await db('split_rules').where({ id: req.params.id, workspace_id: req.workspace_id }).delete();
    await req.logger.info('split_rule.delete.success', { id: req.params.id });
    res.json({ deleted: req.params.id });
  } catch (err) {
    await req.logger.error('split_rule.delete.failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete split rule' });
  }
});

module.exports = router;
module.exports.validateConditions = validateConditions;
module.exports.validateTemplate = validateTemplate;
