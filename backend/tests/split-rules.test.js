require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, USER_ID, setupAppWithDb } = require('./helpers');

const token = makeToken();

beforeAll(() => {
  setupAppWithDb(app, db);
});

afterEach(async () => {
  await db('split_rules').where('workspace_id', WORKSPACE_ID).del();
  await db('transactions').where('workspace_id', WORKSPACE_ID).del();
  // Remove any workspace-specific enum values added by tests; leave global builtins intact
  await db('workspace_enum_values').where('workspace_id', WORKSPACE_ID).del();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PERCENT_RULE = {
  name: 'Rent + utilities split',
  enabled: true,
  conditions: [
    { field: 'amount', operator: 'equals', value: '1000' },
  ],
  template: [
    { type: 'income',  category: 'rent',      description: 'Rent portion',      amount_type: 'percent', amount_value: 80 },
    { type: 'expense', category: 'utilities',  description: 'Utilities portion', amount_type: 'percent', amount_value: 20 },
  ],
};

const FIXED_RULE = {
  name: 'Fixed split',
  enabled: true,
  conditions: [
    { field: 'description', operator: 'contains', value: 'combined' },
  ],
  template: [
    { type: 'income',  category: 'rent',     description: 'Rent',     amount_type: 'fixed', amount_value: 700 },
    { type: 'expense', category: 'utilities', description: 'Utils',   amount_type: 'fixed', amount_value: 300 },
  ],
};

const VALID_IMPORT_ROW = {
  date:        '2026-03-01',
  type:        'income',
  category:    'rent',
  amount:      1000,
  currency:    'USD',
  description: 'Monthly payment',
};

// ---------------------------------------------------------------------------
// POST /api/split-rules
// ---------------------------------------------------------------------------
describe('POST /api/split-rules', () => {
  it('creates a percent rule and returns 201', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(PERCENT_RULE);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(PERCENT_RULE.name);
    expect(res.body.enabled).toBe(true);
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(Array.isArray(res.body.conditions)).toBe(true);
    expect(Array.isArray(res.body.template)).toBe(true);
    expect(res.body.template).toHaveLength(2);
  });

  it('creates a fixed rule and returns 201', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(FIXED_RULE);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(FIXED_RULE.name);
  });

  it('returns 422 when name is missing', async () => {
    const { name, ...body } = PERCENT_RULE;
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/name/)]));
  });

  it('returns 422 when conditions is empty', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [] });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/conditions/)]));
  });

  it('returns 422 when template has only one row', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, template: [PERCENT_RULE.template[0]] });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/at least 2/)]));
  });

  it('returns 422 when percent rows do not sum to 100', async () => {
    const bad = {
      ...PERCENT_RULE,
      template: [
        { ...PERCENT_RULE.template[0], amount_value: 60 },
        { ...PERCENT_RULE.template[1], amount_value: 20 },
      ],
    };
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(bad);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/sum to 100/)]));
  });

  it('returns 422 when template rows use mixed amount_type', async () => {
    const bad = {
      ...PERCENT_RULE,
      template: [
        { ...PERCENT_RULE.template[0], amount_type: 'fixed' },
        { ...PERCENT_RULE.template[1], amount_type: 'percent' },
      ],
    };
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(bad);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/same amount_type/)]));
  });

  it('returns 422 when condition field is invalid', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [{ field: 'banana', operator: 'equals', value: '1' }] });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/field/)]));
  });

  it('returns 422 when condition operator is invalid for the field', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [{ field: 'amount', operator: 'contains', value: '100' }] });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/operator/)]));
  });

  it('returns 422 when account_id condition value is not an array', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [{ field: 'account_id', operator: 'in', value: 'not-an-array' }] });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/array/)]));
  });

  it('accepts account_id condition with empty array (match all)', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [{ field: 'account_id', operator: 'in', value: [] }] });

    expect(res.status).toBe(201);
  });

  it('accepts property_id condition with array value', async () => {
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, conditions: [{ field: 'property_id', operator: 'in', value: ['some-uuid'] }] });

    expect(res.status).toBe(201);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/split-rules').send(PERCENT_RULE);
    expect(res.status).toBe(401);
  });

  // ── Category validation against workspace_enum_values ──────────────────────

  it('returns 422 when a template category does not exist in workspace_enum_values', async () => {
    const bad = {
      ...PERCENT_RULE,
      template: [
        { type: 'income',  category: 'completely_unknown_cat', description: 'A', amount_type: 'percent', amount_value: 60 },
        { type: 'expense', category: 'utilities',              description: 'B', amount_type: 'percent', amount_value: 40 },
      ],
    };
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(bad);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/completely_unknown_cat.*not valid/)])
    );
  });

  it('returns 422 when a template category is valid but used with the wrong type', async () => {
    // "rent" is an income category — using it under type "expense" should fail
    const bad = {
      ...PERCENT_RULE,
      template: [
        { type: 'expense', category: 'rent',      description: 'Wrong bucket', amount_type: 'percent', amount_value: 60 },
        { type: 'expense', category: 'utilities', description: 'Utils',        amount_type: 'percent', amount_value: 40 },
      ],
    };
    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(bad);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/rent.*not valid.*expense/)])
    );
  });

  it('accepts a workspace-specific custom category not in the built-in list', async () => {
    // Seed a custom category for this workspace
    await db('workspace_enum_values').insert({
      workspace_id: WORKSPACE_ID,
      enum_type:    'transaction_category',
      type_bucket:  'transfer',
      value:        'custom_transfer_cat',
      label:        'Custom Transfer Category',
      is_builtin:   false,
      is_active:    true,
    });

    const rule = {
      name: 'Custom category split',
      enabled: true,
      conditions: [{ field: 'amount', operator: 'equals', value: '500' }],
      template: [
        { type: 'transfer', category: 'custom_transfer_cat', description: 'Custom', amount_type: 'fixed', amount_value: 300 },
        { type: 'transfer', category: 'inter_account',        description: 'Inter',  amount_type: 'fixed', amount_value: 200 },
      ],
    };

    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(rule);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Custom category split');
  });

  it('rejects a workspace-specific category that belongs to a different workspace', async () => {
    // Seed the custom category under a different workspace — should NOT be visible to WORKSPACE_ID
    const otherWorkspaceId = '00000000-0000-0000-0000-000000000099';
    await db('workspaces').insert({ id: otherWorkspaceId, name: 'Other Workspace' });
    await db('workspace_enum_values').insert({
      workspace_id: otherWorkspaceId,
      enum_type:    'transaction_category',
      type_bucket:  'transfer',
      value:        'other_workspace_cat',
      label:        'Other Workspace Category',
      is_builtin:   false,
      is_active:    true,
    });

    const rule = {
      name: 'Other workspace category',
      enabled: true,
      conditions: [{ field: 'amount', operator: 'equals', value: '500' }],
      template: [
        { type: 'transfer', category: 'other_workspace_cat', description: 'A', amount_type: 'fixed', amount_value: 300 },
        { type: 'transfer', category: 'inter_account',        description: 'B', amount_type: 'fixed', amount_value: 200 },
      ],
    };

    const res = await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send(rule);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/other_workspace_cat.*not valid/)])
    );

    // Cleanup (FK order: enum values first, then workspace)
    await db('workspace_enum_values').where({ workspace_id: otherWorkspaceId }).del();
    await db('workspaces').where('id', otherWorkspaceId).del();
  });
});

// ---------------------------------------------------------------------------
// GET /api/split-rules
// ---------------------------------------------------------------------------
describe('GET /api/split-rules', () => {
  it('returns all rules for the workspace', async () => {
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(FIXED_RULE);

    const res = await request(app).get('/api/split-rules').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns empty array when no rules exist', async () => {
    const res = await request(app).get('/api/split-rules').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/split-rules/:id
// ---------------------------------------------------------------------------
describe('GET /api/split-rules/:id', () => {
  it('returns a single rule', async () => {
    const create = await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);
    const res = await request(app).get(`/api/split-rules/${create.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/split-rules/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/split-rules/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/split-rules/:id', () => {
  it('updates name and enabled', async () => {
    const create = await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);
    const res = await request(app)
      .patch(`/api/split-rules/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated name', enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated name');
    expect(res.body.enabled).toBe(false);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/api/split-rules/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/split-rules/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/split-rules/:id', () => {
  it('deletes a rule and returns the deleted id', async () => {
    const create = await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);
    const res = await request(app).delete(`/api/split-rules/${create.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(create.body.id);

    const check = await request(app).get(`/api/split-rules/${create.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/split-rules/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Import pipeline: split rule evaluation
// ---------------------------------------------------------------------------
describe('POST /api/transactions/import — split rule evaluation', () => {
  it('auto-splits a row matching a percent rule', async () => {
    // Create an enabled percent rule matching amount=1000
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);

    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([VALID_IMPORT_ROW]);

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);
    expect(res.body.auto_split_count).toBe(1);

    // Verify parent + 2 children were created
    const all = await db('transactions').where('workspace_id', WORKSPACE_ID).orderBy('created_at', 'asc');
    expect(all).toHaveLength(3); // 1 parent + 2 children

    const parent   = all.find(t => t.parent_transaction_id === null);
    const children = all.filter(t => t.parent_transaction_id !== null);
    expect(parent).toBeDefined();
    expect(children).toHaveLength(2);

    // Verify children sum to parent amount
    const childSum = children.reduce((s, c) => s + parseFloat(c.amount), 0);
    expect(childSum).toBeCloseTo(parseFloat(parent.amount), 2);

    // Verify percent amounts: 80% and 20% of 1000
    const amounts = children.map(c => parseFloat(c.amount)).sort((a, b) => b - a);
    expect(amounts[0]).toBeCloseTo(800, 2);
    expect(amounts[1]).toBeCloseTo(200, 2);
  });

  it('auto-splits a row matching a fixed rule', async () => {
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(FIXED_RULE);

    const row = { ...VALID_IMPORT_ROW, amount: 1000, description: 'combined payment' };
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([row]);

    expect(res.status).toBe(201);
    expect(res.body.auto_split_count).toBe(1);

    const children = await db('transactions').where('workspace_id', WORKSPACE_ID).whereNotNull('parent_transaction_id');
    expect(children).toHaveLength(2);
    const amounts = children.map(c => parseFloat(c.amount)).sort((a, b) => b - a);
    expect(amounts[0]).toBe(700);
    expect(amounts[1]).toBe(300);
  });

  it('does not split rows that do not match any rule', async () => {
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);

    // Amount 999 ≠ 1000, so no match
    const row = { ...VALID_IMPORT_ROW, amount: 999 };
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([row]);

    expect(res.status).toBe(201);
    expect(res.body.auto_split_count).toBe(0);
    const all = await db('transactions').where('workspace_id', WORKSPACE_ID);
    expect(all).toHaveLength(1);
  });

  it('does not apply disabled rules', async () => {
    await request(app)
      .post('/api/split-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PERCENT_RULE, enabled: false });

    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([VALID_IMPORT_ROW]);

    expect(res.status).toBe(201);
    expect(res.body.auto_split_count).toBe(0);
    const all = await db('transactions').where('workspace_id', WORKSPACE_ID);
    expect(all).toHaveLength(1);
  });

  it('applies the first matching rule when multiple rules match', async () => {
    // Both rules match: percent rule (amount=1000) and a second rule (description contains 'Monthly')
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(PERCENT_RULE);
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send({
      ...FIXED_RULE,
      conditions: [{ field: 'description', operator: 'contains', value: 'Monthly' }],
    });

    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([VALID_IMPORT_ROW]); // amount=1000 and description='Monthly payment'

    expect(res.status).toBe(201);
    expect(res.body.auto_split_count).toBe(1);

    // First rule applied: percent (80/20), not fixed (700/300)
    const children = await db('transactions').where('workspace_id', WORKSPACE_ID).whereNotNull('parent_transaction_id');
    const amounts = children.map(c => parseFloat(c.amount)).sort((a, b) => b - a);
    expect(amounts[0]).toBeCloseTo(800, 2);
    expect(amounts[1]).toBeCloseTo(200, 2);
  });

  it('auto-splits using a workspace-specific custom category', async () => {
    // Seed a custom income category for this workspace
    await db('workspace_enum_values').insert({
      workspace_id: WORKSPACE_ID,
      enum_type:    'transaction_category',
      type_bucket:  'income',
      value:        'custom_income_type',
      label:        'Custom Income Type',
      is_builtin:   false,
      is_active:    true,
    });

    const rule = {
      name: 'Custom category split',
      enabled: true,
      conditions: [{ field: 'amount', operator: 'equals', value: '1000' }],
      template: [
        { type: 'income', category: 'custom_income_type', description: 'Custom', amount_type: 'percent', amount_value: 70 },
        { type: 'income', category: 'rent',               description: 'Rent',   amount_type: 'percent', amount_value: 30 },
      ],
    };
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(rule);

    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([VALID_IMPORT_ROW]);

    expect(res.status).toBe(201);
    expect(res.body.auto_split_count).toBe(1);
    const children = await db('transactions').where('workspace_id', WORKSPACE_ID).whereNotNull('parent_transaction_id');
    expect(children).toHaveLength(2);
    const customChild = children.find(c => c.category === 'custom_income_type');
    expect(customChild).toBeDefined();
    expect(parseFloat(customChild.amount)).toBeCloseTo(700, 2);
  });

  it('handles rounding in percent mode (remainder goes to last child)', async () => {
    // 3-way 33.33% split of 100 → 33.33 + 33.33 + 33.34
    const rule = {
      name: 'Three-way even split',
      enabled: true,
      conditions: [{ field: 'amount', operator: 'equals', value: '100' }],
      template: [
        { type: 'expense', category: 'utilities', description: 'A', amount_type: 'percent', amount_value: 33.34 },
        { type: 'expense', category: 'utilities', description: 'B', amount_type: 'percent', amount_value: 33.33 },
        { type: 'expense', category: 'utilities', description: 'C', amount_type: 'percent', amount_value: 33.33 },
      ],
    };
    await request(app).post('/api/split-rules').set('Authorization', `Bearer ${token}`).send(rule);

    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ...VALID_IMPORT_ROW, amount: 100 }]);

    expect(res.status).toBe(201);
    const children = await db('transactions').where('workspace_id', WORKSPACE_ID).whereNotNull('parent_transaction_id');
    const childSum = children.reduce((s, c) => s + parseFloat(c.amount), 0);
    expect(childSum).toBeCloseTo(100, 2);
  });
});
