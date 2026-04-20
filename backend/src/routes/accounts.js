const express = require('express');
const db = require('../db/knex');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['active', 'archived', 'all'];

// GET /api/accounts
// Returns all accounts in the workspace. Supports ?status=active|archived|all (default: active)
router.get('/', requireAuth, async (req, res) => {
  try {
    await req.logger.info('account.list.started');

    const status = req.query.status || 'active';
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    let query = db('accounts').where({ workspace_id: req.workspace_id });
    if (status === 'active') query = query.where({ is_active: true });
    if (status === 'archived') query = query.where({ is_active: false });

    const accounts = await query.orderBy('name', 'asc').select('*');

    await req.logger.info('account.list.success', { account_count: accounts.length, status });
    res.json(accounts);
  } catch (err) {
    await req.logger.error('account.list.failed', { error: err.message });
    console.error('GET /api/accounts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET /api/accounts/:id
// Returns a single account with its ancestor path and direct children
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await req.logger.info('account.get.started', { account_id: id });

    const account = await db('accounts')
      .where({ id, workspace_id: req.workspace_id })
      .first();

    if (!account) {
      await req.logger.debug('account.get.notfound', { account_id: id });
      return res.status(404).json({ error: 'Account not found' });
    }

    // Build ancestor path via recursive CTE (root first)
    const ancestorRows = await db.raw(`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, parent_account_id, 0 AS depth
        FROM accounts
        WHERE id = :id AND workspace_id = :workspace_id
        UNION ALL
        SELECT a.id, a.name, a.parent_account_id, anc.depth + 1
        FROM accounts a
        INNER JOIN ancestors anc ON a.id = anc.parent_account_id
        WHERE a.workspace_id = :workspace_id
      )
      SELECT id, name, parent_account_id, depth
      FROM ancestors
      WHERE id != :id
      ORDER BY depth DESC
    `, { id, workspace_id: req.workspace_id });

    const parent_path = ancestorRows.rows;

    // Direct children
    const children = await db('accounts')
      .where({ parent_account_id: id, workspace_id: req.workspace_id })
      .orderBy('name', 'asc')
      .select('id', 'name', 'is_active', 'is_default');

    await req.logger.info('account.get.success', { account_id: id });
    res.json({ ...account, parent_path, children });
  } catch (err) {
    await req.logger.error('account.get.failed', { error: err.message });
    console.error('GET /api/accounts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /api/accounts
// Creates an account. Required: name. Optional: parent_account_id, notes.
// Validates: parent in same workspace, no cycle, depth <= max_account_depth.
router.post('/', requireAuth, async (req, res) => {
  const { name, parent_account_id, notes } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    await req.logger.info('account.create.started', { name: name.trim() });

    const workspace = await db('workspaces').where({ id: req.workspace_id }).first('max_account_depth');
    const maxDepth = workspace.max_account_depth;

    if (parent_account_id) {
      const parent = await db('accounts')
        .where({ id: parent_account_id, workspace_id: req.workspace_id })
        .first();

      if (!parent) {
        return res.status(400).json({ error: 'parent_account_id does not exist in this workspace' });
      }
      if (!parent.is_active) {
        return res.status(400).json({ error: 'Cannot add a child to an archived account' });
      }

      // Depth check: count ancestors of parent (parent is depth 1, so new child is depth+1)
      const depthResult = await db.raw(`
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_account_id, 1 AS depth
          FROM accounts
          WHERE id = :parent_id AND workspace_id = :workspace_id
          UNION ALL
          SELECT a.id, a.parent_account_id, anc.depth + 1
          FROM accounts a
          INNER JOIN ancestors anc ON a.id = anc.parent_account_id
          WHERE a.workspace_id = :workspace_id
        )
        SELECT MAX(depth) AS depth FROM ancestors
      `, { parent_id: parent_account_id, workspace_id: req.workspace_id });

      const parentDepth = depthResult.rows[0].depth || 1;
      if (parentDepth >= maxDepth) {
        return res.status(400).json({
          error: `Adding this account would exceed the maximum account depth of ${maxDepth}`,
        });
      }
    }

    const [created] = await db('accounts')
      .insert({
        workspace_id: req.workspace_id,
        name: name.trim(),
        notes: notes || null,
        parent_account_id: parent_account_id || null,
        is_active: true,
        is_default: false,
        created_by: req.user.id,
        last_modified_by: req.user.id,
      })
      .returning('*');

    await req.logger.info('account.create.success', { account_id: created.id });
    res.status(201).json(created);
  } catch (err) {
    await req.logger.error('account.create.failed', { error: err.message });
    console.error('POST /api/accounts error:', err.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PATCH /api/accounts/:id
// Updates name, notes, or parent_account_id. Re-parent validates cycle + depth.
// Cannot change parent of the default account.
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, notes, parent_account_id } = req.body;

  try {
    await req.logger.info('account.update.started', { account_id: id });

    const account = await db('accounts')
      .where({ id, workspace_id: req.workspace_id })
      .first();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updates = { last_modified_by: req.user.id, last_modified_at: db.fn.now() };

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      updates.name = name.trim();
    }

    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    if (parent_account_id !== undefined) {
      if (account.is_default) {
        return res.status(400).json({ error: 'Cannot set a parent on the default account' });
      }

      if (parent_account_id !== null) {
        if (parent_account_id === id) {
          return res.status(400).json({ error: 'An account cannot be its own parent' });
        }

        const parent = await db('accounts')
          .where({ id: parent_account_id, workspace_id: req.workspace_id })
          .first();

        if (!parent) {
          return res.status(400).json({ error: 'parent_account_id does not exist in this workspace' });
        }
        if (!parent.is_active) {
          return res.status(400).json({ error: 'Cannot set an archived account as parent' });
        }

        // Cycle check: new parent must not be a descendant of the account being moved
        const descendantCheck = await db.raw(`
          WITH RECURSIVE descendants AS (
            SELECT id FROM accounts WHERE id = :id AND workspace_id = :workspace_id
            UNION ALL
            SELECT a.id FROM accounts a
            INNER JOIN descendants d ON a.parent_account_id = d.id
            WHERE a.workspace_id = :workspace_id
          )
          SELECT 1 FROM descendants WHERE id = :parent_id LIMIT 1
        `, { id, workspace_id: req.workspace_id, parent_id: parent_account_id });

        if (descendantCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Cannot re-parent: would create a cycle' });
        }

        // Depth check
        const workspace = await db('workspaces').where({ id: req.workspace_id }).first('max_account_depth');
        const maxDepth = workspace.max_account_depth;

        const depthResult = await db.raw(`
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_account_id, 1 AS depth
            FROM accounts
            WHERE id = :parent_id AND workspace_id = :workspace_id
            UNION ALL
            SELECT a.id, a.parent_account_id, anc.depth + 1
            FROM accounts a
            INNER JOIN ancestors anc ON a.id = anc.parent_account_id
            WHERE a.workspace_id = :workspace_id
          )
          SELECT MAX(depth) AS depth FROM ancestors
        `, { parent_id: parent_account_id, workspace_id: req.workspace_id });

        const parentDepth = depthResult.rows[0].depth || 1;
        if (parentDepth >= maxDepth) {
          return res.status(400).json({
            error: `Re-parenting would exceed the maximum account depth of ${maxDepth}`,
          });
        }
      }

      updates.parent_account_id = parent_account_id;
    }

    const [updated] = await db('accounts').where({ id }).update(updates).returning('*');

    await req.logger.info('account.update.success', { account_id: id });
    res.json(updated);
  } catch (err) {
    await req.logger.error('account.update.failed', { error: err.message });
    console.error('PATCH /api/accounts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /api/accounts/:id
// Atomically relinks all transactions and properties from this account to reassign_to,
// then deactivates the account. Cannot delete the default account unless a replacement
// default has already been set via set-default.
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reassign_to } = req.body || {};

  if (!reassign_to) {
    return res.status(400).json({ error: 'reassign_to is required' });
  }

  try {
    await req.logger.info('account.delete.started', { account_id: id, reassign_to });

    const account = await db('accounts')
      .where({ id, workspace_id: req.workspace_id })
      .first();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.is_default) {
      return res.status(400).json({
        error: 'Cannot delete the default account. Designate a new default via set-default first.',
      });
    }

    const target = await db('accounts')
      .where({ id: reassign_to, workspace_id: req.workspace_id })
      .first();

    if (!target) {
      return res.status(400).json({ error: 'reassign_to account does not exist in this workspace' });
    }
    if (!target.is_active) {
      return res.status(400).json({ error: 'reassign_to account must be active' });
    }
    if (reassign_to === id) {
      return res.status(400).json({ error: 'reassign_to must be a different account' });
    }

    await db.transaction(async (trx) => {
      await trx('transactions').where({ account_id: id, workspace_id: req.workspace_id }).update({ account_id: reassign_to });
      await trx('account_properties').where({ account_id: id }).update({ account_id: reassign_to });
      await trx('accounts').where({ id }).update({ is_active: false, last_modified_by: req.user.id, last_modified_at: trx.fn.now() });
    });

    await req.logger.info('account.delete.success', { account_id: id, reassigned_to: reassign_to });
    res.json({ ok: true });
  } catch (err) {
    await req.logger.error('account.delete.failed', { error: err.message });
    console.error('DELETE /api/accounts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/accounts/:id/set-default
// Designates an account as the new workspace default.
// Target must be top-level (no parent) and active. Previous default loses the flag.
router.post('/:id/set-default', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await req.logger.info('account.set_default.started', { account_id: id });

    const account = await db('accounts')
      .where({ id, workspace_id: req.workspace_id })
      .first();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (!account.is_active) {
      return res.status(400).json({ error: 'Cannot set an archived account as default' });
    }
    if (account.parent_account_id !== null) {
      return res.status(400).json({ error: 'Only a top-level account (no parent) can be set as default' });
    }

    await db.transaction(async (trx) => {
      await trx('accounts')
        .where({ workspace_id: req.workspace_id, is_default: true })
        .update({ is_default: false, last_modified_by: req.user.id, last_modified_at: trx.fn.now() });
      await trx('accounts')
        .where({ id })
        .update({ is_default: true, last_modified_by: req.user.id, last_modified_at: trx.fn.now() });
    });

    const updated = await db('accounts').where({ id }).first();

    await req.logger.info('account.set_default.success', { account_id: id });
    res.json(updated);
  } catch (err) {
    await req.logger.error('account.set_default.failed', { error: err.message });
    console.error('POST /api/accounts/:id/set-default error:', err.message);
    res.status(500).json({ error: 'Failed to set default account' });
  }
});

// POST /api/accounts/:id/properties
// Links a property to an account. Property must belong to the same workspace.
router.post('/:id/properties', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { property_id } = req.body;

  if (!property_id) {
    return res.status(400).json({ error: 'property_id is required' });
  }

  try {
    await req.logger.info('account.link_property.started', { account_id: id, property_id });

    const account = await db('accounts')
      .where({ id, workspace_id: req.workspace_id })
      .first();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const property = await db('properties')
      .where({ id: property_id, workspace_id: req.workspace_id })
      .first();

    if (!property) {
      return res.status(400).json({ error: 'Property not found in this workspace' });
    }

    await db('account_properties')
      .insert({ account_id: id, property_id })
      .onConflict(['account_id', 'property_id'])
      .ignore();

    await req.logger.info('account.link_property.success', { account_id: id, property_id });
    res.status(201).json({ ok: true, account_id: id, property_id });
  } catch (err) {
    await req.logger.error('account.link_property.failed', { error: err.message });
    console.error('POST /api/accounts/:id/properties error:', err.message);
    res.status(500).json({ error: 'Failed to link property to account' });
  }
});

module.exports = router;
