const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/workspace/settings
// Returns current settings for the active workspace
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const { workspace_id } = req;

    const workspace = await db('workspaces')
      .where({ id: workspace_id })
      .select('id', 'reporting_currency', 'max_account_depth')
      .first();

    if (!workspace) {
      await req.logger.debug('workspace.settings.notfound', { workspace_id });
      return res.status(404).json({ error: 'Workspace not found' });
    }

    await req.logger.info('workspace.settings.read', { workspace_id });
    res.json(workspace);
  } catch (err) {
    await req.logger.error('workspace.settings.read.failed', { error: err.message });
    console.error('GET /api/workspace/settings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch workspace settings' });
  }
});

// PATCH /api/workspace/settings
// Updates workspace settings; only owners can update
router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const { workspace_id, user } = req;
    const user_id = user.id;

    // Verify user is owner of this workspace
    const workspace_user = await db('workspace_users')
      .where({ workspace_id, user_id })
      .select('role')
      .first();

    if (!workspace_user || workspace_user.role !== 'owner') {
      await req.logger.debug('workspace.settings.update.denied', {
        workspace_id,
        user_id,
        reason: 'not_owner',
      });
      return res.status(403).json({ error: 'Only workspace owners can update settings' });
    }

    // Validate and build update object
    const allowed = ['reporting_currency', 'max_account_depth'];
    const updates = {};

    if (req.body.reporting_currency !== undefined) {
      const currency = String(req.body.reporting_currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({ error: 'reporting_currency must be a 3-letter ISO code' });
      }
      updates.reporting_currency = currency;
    }

    if (req.body.max_account_depth !== undefined) {
      const depth = parseInt(req.body.max_account_depth, 10);
      if (isNaN(depth) || depth < 1) {
        return res.status(400).json({ error: 'max_account_depth must be a positive integer' });
      }
      updates.max_account_depth = depth;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid settings to update' });
    }

    // Update the workspace
    const [updated] = await db('workspaces')
      .where({ id: workspace_id })
      .update(updates)
      .returning('*');

    await req.logger.info('workspace.settings.update.success', {
      workspace_id,
      user_id,
      fields: Object.keys(updates),
    });

    res.json(updated);
  } catch (err) {
    await req.logger.error('workspace.settings.update.failed', { error: err.message });
    console.error('PATCH /api/workspace/settings error:', err.message);
    res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

// ---------------------------------------------------------------------------
// Enum management — transaction categories
// ---------------------------------------------------------------------------

// GET /api/workspace/enums/transaction-categories
// Returns all active categories (built-ins + custom for this workspace)
// grouped by type_bucket. Accessible to all workspace members.
router.get('/enums/transaction-categories', requireAuth, async (req, res) => {
  try {
    const { workspace_id } = req;

    const rows = await db('workspace_enum_values')
      .where('enum_type', 'transaction_category')
      .where('is_active', true)
      .where(function () {
        this.whereNull('workspace_id').orWhere('workspace_id', workspace_id);
      })
      .select('id', 'type_bucket', 'value', 'is_builtin')
      .orderBy(['type_bucket', 'value']);

    // Group by type_bucket
    const grouped = {};
    for (const row of rows) {
      const bucket = row.type_bucket || 'other';
      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push({ id: row.id, value: row.value, is_builtin: row.is_builtin });
    }

    await req.logger.info('workspace.enums.transaction-categories.read', { workspace_id });
    res.json(grouped);
  } catch (err) {
    await req.logger.error('workspace.enums.transaction-categories.read.failed', { error: err.message });
    console.error('GET /api/workspace/enums/transaction-categories error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transaction categories' });
  }
});

// POST /api/workspace/enums/transaction-categories
// Creates a custom category. Owner only.
router.post('/enums/transaction-categories', requireAuth, async (req, res) => {
  try {
    const { workspace_id, user } = req;
    const user_id = user.id;

    const wUser = await db('workspace_users')
      .where({ workspace_id, user_id })
      .select('role')
      .first();

    if (!wUser || wUser.role !== 'owner') {
      return res.status(403).json({ error: 'Only workspace owners can manage categories' });
    }

    const { type_bucket, value } = req.body;

    if (!type_bucket || !String(type_bucket).trim()) {
      return res.status(400).json({ error: 'type_bucket is required' });
    }
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: 'value is required' });
    }

    const bucket = String(type_bucket).trim().toLowerCase();
    const val    = String(value).trim().toLowerCase();

    // Check uniqueness across built-ins and custom values for this workspace
    const existing = await db('workspace_enum_values')
      .where('enum_type', 'transaction_category')
      .where('type_bucket', bucket)
      .where('value', val)
      .where(function () {
        this.whereNull('workspace_id').orWhere('workspace_id', workspace_id);
      })
      .first();

    if (existing) {
      return res.status(409).json({ error: `Category '${val}' already exists in '${bucket}'` });
    }

    const [created] = await db('workspace_enum_values')
      .insert({
        workspace_id,
        enum_type:  'transaction_category',
        type_bucket: bucket,
        value:       val,
        is_builtin:  false,
        is_active:   true,
        created_by:  user_id,
      })
      .returning(['id', 'type_bucket', 'value', 'is_builtin']);

    await req.logger.info('workspace.enums.transaction-categories.created', {
      workspace_id,
      user_id,
      type_bucket: bucket,
      value: val,
    });
    res.status(201).json(created);
  } catch (err) {
    await req.logger.error('workspace.enums.transaction-categories.create.failed', { error: err.message });
    console.error('POST /api/workspace/enums/transaction-categories error:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// DELETE /api/workspace/enums/transaction-categories/:id
// Removes a custom category. Owner only.
// Rejected if built-in or if any transaction in this workspace uses the category value.
router.delete('/enums/transaction-categories/:id', requireAuth, async (req, res) => {
  try {
    const { workspace_id, user } = req;
    const user_id = user.id;

    const wUser = await db('workspace_users')
      .where({ workspace_id, user_id })
      .select('role')
      .first();

    if (!wUser || wUser.role !== 'owner') {
      return res.status(403).json({ error: 'Only workspace owners can manage categories' });
    }

    const { id } = req.params;

    const category = await db('workspace_enum_values')
      .where('id', id)
      .where('enum_type', 'transaction_category')
      .where(function () {
        this.whereNull('workspace_id').orWhere('workspace_id', workspace_id);
      })
      .first();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.is_builtin) {
      return res.status(403).json({ error: 'Built-in categories cannot be deleted' });
    }

    // Reject if any transaction in this workspace uses this category value
    const inUse = await db('transactions as t')
      .join('accounts as a', 't.account_id', 'a.id')
      .where('t.category', category.value)
      .where('a.workspace_id', workspace_id)
      .count('t.id as cnt')
      .first();

    if (parseInt(inUse.cnt, 10) > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${inUse.cnt} transaction(s) use this category`,
        count: parseInt(inUse.cnt, 10),
      });
    }

    await db('workspace_enum_values').where('id', id).delete();

    await req.logger.info('workspace.enums.transaction-categories.deleted', {
      workspace_id,
      user_id,
      category_id: id,
      value: category.value,
    });
    res.status(204).end();
  } catch (err) {
    await req.logger.error('workspace.enums.transaction-categories.delete.failed', { error: err.message });
    console.error('DELETE /api/workspace/enums/transaction-categories/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
