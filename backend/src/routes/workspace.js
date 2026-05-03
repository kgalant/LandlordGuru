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
      .select('id', 'reporting_currency', 'max_account_depth', 'date_format')
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
    const allowed = ['reporting_currency', 'max_account_depth', 'date_format'];
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

    if (req.body.date_format !== undefined) {
      const VALID_FORMATS = ['YYYY-MM-DD', 'MM-DD-YYYY', 'DD-MM-YYYY'];
      if (!VALID_FORMATS.includes(req.body.date_format)) {
        return res.status(400).json({ error: 'date_format must be one of: YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY' });
      }
      updates.date_format = req.body.date_format;
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
// Returns categories (built-ins + custom for this workspace) grouped by type_bucket.
// ?include_inactive=true — include inactive rows (for the settings UI).
// Effective label and is_active for built-ins are resolved from workspace_enum_overrides.
// Accessible to all workspace members.
router.get('/enums/transaction-categories', requireAuth, async (req, res) => {
  try {
    const { workspace_id } = req;
    const includeInactive = req.query.include_inactive === 'true';

    const rows = await db('workspace_enum_values as wev')
      .leftJoin('workspace_enum_overrides as weo', function () {
        this.on('weo.enum_value_id', 'wev.id').andOn('weo.workspace_id', db.raw('?', [workspace_id]));
      })
      .where('wev.enum_type', 'transaction_category')
      .where(function () {
        this.whereNull('wev.workspace_id').orWhere('wev.workspace_id', workspace_id);
      })
      .modify(function (qb) {
        if (!includeInactive) {
          // built-ins: active unless override says false; custom: use own is_active
          qb.where(function () {
            this
              .where(function () {
                // built-in with no override or override.is_active = true
                this.where('wev.is_builtin', true)
                  .where(function () {
                    this.whereNull('weo.is_active').orWhere('weo.is_active', true);
                  });
              })
              .orWhere(function () {
                // custom with is_active = true
                this.where('wev.is_builtin', false).where('wev.is_active', true);
              });
          });
        }
      })
      .select(
        'wev.id',
        'wev.type_bucket',
        'wev.value',
        'wev.is_builtin',
        db.raw('COALESCE(weo.label, wev.label) AS label'),
        db.raw(`
          CASE
            WHEN wev.is_builtin THEN COALESCE(weo.is_active, true)
            ELSE wev.is_active
          END AS is_active
        `)
      )
      .orderBy(['wev.type_bucket', 'wev.value']);

    const grouped = {};
    for (const row of rows) {
      const bucket = row.type_bucket || 'other';
      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push({
        id:         row.id,
        value:      row.value,
        label:      row.label,
        is_builtin: row.is_builtin,
        is_active:  row.is_active,
      });
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

    const { type_bucket, value, label } = req.body;

    if (!type_bucket || !String(type_bucket).trim()) {
      return res.status(400).json({ error: 'type_bucket is required' });
    }
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: 'value is required' });
    }
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: 'label is required' });
    }

    const bucket = String(type_bucket).trim().toLowerCase();
    const val    = String(value).trim().toLowerCase();
    const lbl    = String(label).trim();

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
      return res.status(409).json({ error: `Category code '${val}' already exists in '${bucket}'` });
    }

    const [created] = await db('workspace_enum_values')
      .insert({
        workspace_id,
        enum_type:   'transaction_category',
        type_bucket: bucket,
        value:       val,
        label:       lbl,
        is_builtin:  false,
        is_active:   true,
        created_by:  user_id,
      })
      .returning(['id', 'type_bucket', 'value', 'label', 'is_builtin', 'is_active']);

    await req.logger.info('workspace.enums.transaction-categories.created', {
      workspace_id,
      user_id,
      type_bucket: bucket,
      value: val,
      label: lbl,
    });
    res.status(201).json(created);
  } catch (err) {
    await req.logger.error('workspace.enums.transaction-categories.create.failed', { error: err.message });
    console.error('POST /api/workspace/enums/transaction-categories error:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/workspace/enums/transaction-categories/:id
// Updates label and/or is_active for any category. Owner only.
// For built-in categories: upserts a per-workspace row in workspace_enum_overrides.
// For custom categories: updates the workspace_enum_values row directly.
router.patch('/enums/transaction-categories/:id', requireAuth, async (req, res) => {
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
    const { label, is_active } = req.body;

    if (label === undefined && is_active === undefined) {
      return res.status(400).json({ error: 'At least one of label or is_active is required' });
    }
    if (label !== undefined && !String(label).trim()) {
      return res.status(400).json({ error: 'label cannot be empty' });
    }

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
      // Upsert into workspace_enum_overrides for per-workspace customisation
      const overrideData = { updated_at: db.fn.now(), updated_by: user_id };
      if (label    !== undefined) overrideData.label     = String(label).trim();
      if (is_active !== undefined) overrideData.is_active = Boolean(is_active);

      await db('workspace_enum_overrides')
        .insert({ workspace_id, enum_value_id: id, ...overrideData })
        .onConflict(['workspace_id', 'enum_value_id'])
        .merge(overrideData);

      // Return effective values
      const override = await db('workspace_enum_overrides')
        .where({ workspace_id, enum_value_id: id })
        .first();

      return res.json({
        id:         category.id,
        value:      category.value,
        label:      override.label     ?? category.label,
        is_active:  override.is_active ?? true,
        is_builtin: true,
      });
    }

    // Custom category — direct update
    const updateData = {};
    if (label    !== undefined) updateData.label     = String(label).trim();
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const [updated] = await db('workspace_enum_values')
      .where('id', id)
      .update(updateData)
      .returning(['id', 'value', 'label', 'is_active', 'is_builtin']);

    await req.logger.info('workspace.enums.transaction-categories.updated', {
      workspace_id, user_id, category_id: id, ...updateData,
    });
    res.json(updated);
  } catch (err) {
    await req.logger.error('workspace.enums.transaction-categories.update.failed', { error: err.message });
    console.error('PATCH /api/workspace/enums/transaction-categories/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update category' });
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
