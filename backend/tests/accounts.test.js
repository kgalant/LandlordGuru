require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, setupAppWithDb } = require('./helpers');

const token = makeToken();

beforeAll(() => {
  setupAppWithDb(app, db);
});

afterEach(async () => {
  await db('account_properties').whereIn('account_id',
    db('accounts').where('workspace_id', WORKSPACE_ID).select('id')
  ).del();
  await db('transactions').where('workspace_id', WORKSPACE_ID).update({ account_id: null });
  await db('accounts').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

async function createAccount(overrides = {}) {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Account', ...overrides });
  return res.body;
}

// ---------------------------------------------------------------------------
// Schema constraints (kept from F2-3)
// ---------------------------------------------------------------------------
describe('Accounts schema constraints', () => {
  it('enforces constraint: default account cannot have a parent', async () => {
    const [parent] = await db('accounts').insert({
      workspace_id: WORKSPACE_ID, name: 'Parent', is_default: false,
    }).returning('*');

    await expect(
      db('accounts').insert({
        workspace_id: WORKSPACE_ID, name: 'Bad Default', is_default: true, parent_account_id: parent.id,
      })
    ).rejects.toThrow();
  });

  it('enforces unique default per workspace', async () => {
    await db('accounts').insert({ workspace_id: WORKSPACE_ID, name: 'D1', is_default: true });
    await expect(
      db('accounts').insert({ workspace_id: WORKSPACE_ID, name: 'D2', is_default: true })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GET /api/accounts
// ---------------------------------------------------------------------------
describe('GET /api/accounts', () => {
  it('returns active accounts by default', async () => {
    await createAccount({ name: 'Active Account' });
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every(a => a.is_active)).toBe(true);
  });

  it('returns all accounts with ?status=all', async () => {
    const a = await createAccount({ name: 'Active' });
    const b = await createAccount({ name: 'To Archive' });
    await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });

    const res = await request(app).get('/api/accounts?status=all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some(x => x.id === a.id)).toBe(true);
    expect(res.body.some(x => x.id === b.id)).toBe(true);
  });

  it('returns only archived accounts with ?status=archived', async () => {
    const a = await createAccount({ name: 'Active' });
    const b = await createAccount({ name: 'To Archive' });
    await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });

    const res = await request(app).get('/api/accounts?status=archived').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every(x => !x.is_active)).toBe(true);
    expect(res.body.some(x => x.id === b.id)).toBe(true);
  });

  it('returns 400 for invalid status param', async () => {
    const res = await request(app).get('/api/accounts?status=invalid').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('does not return accounts from another workspace', async () => {
    await createAccount({ name: 'Mine' });
    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/accounts')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/accounts/:id
// ---------------------------------------------------------------------------
describe('GET /api/accounts/:id', () => {
  it('returns account with empty parent_path and children for a root account', async () => {
    const a = await createAccount({ name: 'Root' });
    const res = await request(app).get(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(a.id);
    expect(res.body.parent_path).toEqual([]);
    expect(res.body.children).toEqual([]);
  });

  it('returns parent_path for a child account', async () => {
    const parent = await createAccount({ name: 'Parent' });
    const child = await createAccount({ name: 'Child', parent_account_id: parent.id });

    const res = await request(app).get(`/api/accounts/${child.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.parent_path.length).toBe(1);
    expect(res.body.parent_path[0].id).toBe(parent.id);
  });

  it('returns direct children', async () => {
    const parent = await createAccount({ name: 'Parent' });
    const child = await createAccount({ name: 'Child', parent_account_id: parent.id });

    const res = await request(app).get(`/api/accounts/${parent.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(1);
    expect(res.body.children[0].id).toBe(child.id);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/accounts/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for account in another workspace', async () => {
    const a = await createAccount({ name: 'Mine' });
    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app).get(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/accounts/some-id')).status).toBe(401);
  });

  it('returns transaction_count and property_count', async () => {
    const a = await createAccount({ name: 'Counted' });

    // Link a transaction to this account
    await db('transactions').insert({
      workspace_id: WORKSPACE_ID,
      account_id:   a.id,
      date:         '2026-01-01',
      type:         'income',
      category:     'rent',
      amount:       1000,
      currency:     'DKK',
      description:  'test tx',
      source:       'manual',
    });

    // Link a property to this account
    const [prop] = await db('properties').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Count Prop',
      country: 'DK',
      currency: 'DKK',
      model: 'longterm',
    }).returning('id');
    await db('account_properties').insert({ account_id: a.id, property_id: prop.id });

    const res = await request(app).get(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(1);
    expect(res.body.property_count).toBe(1);
  });

  it('returns zero counts for an account with no linked items', async () => {
    const a = await createAccount({ name: 'Empty' });
    const res = await request(app).get(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(0);
    expect(res.body.property_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/accounts
// ---------------------------------------------------------------------------
describe('POST /api/accounts', () => {
  it('creates an account and returns 201', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'New Account' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Account');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(res.body.is_active).toBe(true);
    expect(res.body.is_default).toBe(false);
  });

  it('creates a child account under a valid parent', async () => {
    const parent = await createAccount({ name: 'Parent' });
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child', parent_account_id: parent.id });
    expect(res.status).toBe(201);
    expect(res.body.parent_account_id).toBe(parent.id);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('returns 400 when parent_account_id is from another workspace', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child', parent_account_id: '00000000-0000-0000-0000-000000000099' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workspace/);
  });

  it('returns 400 when parent is archived', async () => {
    const a = await createAccount({ name: 'Active' });
    const b = await createAccount({ name: 'To Archive' });
    await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });

    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child', parent_account_id: b.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archived/);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).post('/api/accounts').send({ name: 'X' })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/accounts/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/accounts/:id', () => {
  it('updates the name', async () => {
    const a = await createAccount({ name: 'Old Name' });
    const res = await request(app).patch(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('updates notes', async () => {
    const a = await createAccount({ name: 'Acc' });
    const res = await request(app).patch(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`).send({ notes: 'Some notes' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Some notes');
  });

  it('re-parents an account to a valid parent', async () => {
    const p = await createAccount({ name: 'Parent' });
    const c = await createAccount({ name: 'Child' });
    const res = await request(app).patch(`/api/accounts/${c.id}`).set('Authorization', `Bearer ${token}`).send({ parent_account_id: p.id });
    expect(res.status).toBe(200);
    expect(res.body.parent_account_id).toBe(p.id);
  });

  it('returns 400 when re-parenting would create a cycle', async () => {
    const parent = await createAccount({ name: 'Parent' });
    const child = await createAccount({ name: 'Child', parent_account_id: parent.id });
    const res = await request(app).patch(`/api/accounts/${parent.id}`).set('Authorization', `Bearer ${token}`)
      .send({ parent_account_id: child.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cycle/);
  });

  it('returns 400 when setting parent on default account', async () => {
    const a = await createAccount({ name: 'A' });
    await db('accounts').where({ id: a.id }).update({ is_default: true });
    const p = await createAccount({ name: 'Parent' });
    const res = await request(app).patch(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`)
      .send({ parent_account_id: p.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/default/);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/accounts/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`).send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).patch('/api/accounts/some-id').send({ name: 'X' })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/accounts/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/accounts/:id', () => {
  it('deactivates account and returns ok', async () => {
    const a = await createAccount({ name: 'Keep' });
    const b = await createAccount({ name: 'Delete' });
    const res = await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const check = await db('accounts').where({ id: b.id }).first();
    expect(check.is_active).toBe(false);
  });

  it('returns 400 when reassign_to is missing', async () => {
    const a = await createAccount({ name: 'Acc' });
    const res = await request(app).delete(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reassign_to/);
  });

  it('returns 400 when reassign_to is the same account', async () => {
    const a = await createAccount({ name: 'Acc' });
    const res = await request(app).delete(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reassign_to is archived', async () => {
    const a = await createAccount({ name: 'Active' });
    const b = await createAccount({ name: 'Archived' });
    const c = await createAccount({ name: 'To Delete' });
    await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });
    const res = await request(app).delete(`/api/accounts/${c.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: b.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active/);
  });

  it('returns 400 when trying to delete the default account', async () => {
    const a = await createAccount({ name: 'Default' });
    await db('accounts').where({ id: a.id }).update({ is_default: true });
    const b = await createAccount({ name: 'Other' });
    const res = await request(app).delete(`/api/accounts/${a.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: b.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/default/);
  });

  it('returns 404 for unknown account', async () => {
    const a = await createAccount({ name: 'Target' });
    const res = await request(app).delete('/api/accounts/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).delete('/api/accounts/some-id').send({ reassign_to: 'x' })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/accounts/:id/set-default
// ---------------------------------------------------------------------------
describe('POST /api/accounts/:id/set-default', () => {
  it('sets an account as default and clears previous default', async () => {
    const a = await createAccount({ name: 'First' });
    await db('accounts').where({ id: a.id }).update({ is_default: true });
    const b = await createAccount({ name: 'New Default' });

    const res = await request(app).post(`/api/accounts/${b.id}/set-default`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.is_default).toBe(true);
    const aCheck = await db('accounts').where({ id: a.id }).first();
    expect(aCheck.is_default).toBe(false);
  });

  it('returns 400 when target is archived', async () => {
    const a = await createAccount({ name: 'Active' });
    const b = await createAccount({ name: 'To Archive' });
    await request(app).delete(`/api/accounts/${b.id}`).set('Authorization', `Bearer ${token}`).send({ reassign_to: a.id });

    const res = await request(app).post(`/api/accounts/${b.id}/set-default`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archived/);
  });

  it('returns 400 when target has a parent (not top-level)', async () => {
    const p = await createAccount({ name: 'Parent' });
    const c = await createAccount({ name: 'Child', parent_account_id: p.id });
    const res = await request(app).post(`/api/accounts/${c.id}/set-default`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/top-level/);
  });

  it('returns 404 for unknown account', async () => {
    const res = await request(app).post('/api/accounts/00000000-0000-0000-0000-000000000099/set-default')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).post('/api/accounts/some-id/set-default')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/accounts/:id/properties
// ---------------------------------------------------------------------------
describe('POST /api/accounts/:id/properties', () => {
  it('returns 400 when property_id is missing', async () => {
    const acc = await createAccount({ name: 'Account' });
    const res = await request(app).post(`/api/accounts/${acc.id}/properties`)
      .set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/property_id/);
  });

  it('returns 400 when property is from another workspace', async () => {
    const acc = await createAccount({ name: 'Account' });
    const res = await request(app).post(`/api/accounts/${acc.id}/properties`)
      .set('Authorization', `Bearer ${token}`).send({ property_id: '00000000-0000-0000-0000-000000000099' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 when account does not exist', async () => {
    const res = await request(app).post('/api/accounts/00000000-0000-0000-0000-000000000099/properties')
      .set('Authorization', `Bearer ${token}`).send({ property_id: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).post('/api/accounts/some-id/properties').send({ property_id: 'pid' })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/accounts/:id/items
// ---------------------------------------------------------------------------
describe('GET /api/accounts/:id/items', () => {
  it('returns empty lists and zero counts when nothing is linked', async () => {
    const acc = await createAccount({ name: 'Empty' });
    const res = await request(app).get(`/api/accounts/${acc.id}/items`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(0);
    expect(res.body.property_count).toBe(0);
    expect(res.body.transactions).toEqual([]);
    expect(res.body.properties).toEqual([]);
  });

  it('returns linked transactions with correct fields', async () => {
    const acc = await createAccount({ name: 'With Tx' });
    await db('transactions').insert({
      workspace_id: WORKSPACE_ID,
      account_id:   acc.id,
      date:         '2026-03-15',
      type:         'income',
      category:     'rent',
      amount:       1500,
      currency:     'DKK',
      description:  'March rent',
      source:       'manual',
    });

    const res = await request(app).get(`/api/accounts/${acc.id}/items`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(1);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({
      date: '2026-03-15',
      description: 'March rent',
      currency: 'DKK',
    });
    expect(parseFloat(res.body.transactions[0].amount)).toBe(1500);
  });

  it('returns linked properties with correct fields', async () => {
    const acc = await createAccount({ name: 'With Prop' });
    const [prop] = await db('properties').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Sea View Apt',
      address: '12 Ocean Drive',
      country: 'DK',
      currency: 'DKK',
      model: 'longterm',
    }).returning('*');
    await db('account_properties').insert({ account_id: acc.id, property_id: prop.id });

    const res = await request(app).get(`/api/accounts/${acc.id}/items`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.property_count).toBe(1);
    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0]).toMatchObject({ name: 'Sea View Apt', address: '12 Ocean Drive' });
  });

  it('does not include transactions from descendant accounts', async () => {
    const parent = await createAccount({ name: 'Parent' });
    const child  = await createAccount({ name: 'Child', parent_account_id: parent.id });
    await db('transactions').insert({
      workspace_id: WORKSPACE_ID,
      account_id:   child.id,
      date:         '2026-01-01',
      type:         'income',
      category:     'rent',
      amount:       500,
      currency:     'DKK',
      description:  'Child tx',
      source:       'manual',
    });

    const res = await request(app).get(`/api/accounts/${parent.id}/items`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction_count).toBe(0);
    expect(res.body.transactions).toEqual([]);
  });

  it('returns 404 for unknown account', async () => {
    const res = await request(app).get('/api/accounts/00000000-0000-0000-0000-000000000099/items')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for account in another workspace', async () => {
    const acc = await createAccount({ name: 'Mine' });
    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app).get(`/api/accounts/${acc.id}/items`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/accounts/some-id/items')).status).toBe(401);
  });
});
