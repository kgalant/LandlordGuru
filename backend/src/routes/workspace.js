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

module.exports = router;
