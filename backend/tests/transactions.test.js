require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, USER_ID, setupAppWithDb } = require('./helpers');

const token = makeToken();

// Set up app with db for logging middleware
beforeAll(() => {
  setupAppWithDb(app, db);
});

// Use reporting_currency (USD) so no rate lookup is required for base tests
const VALID_TX = {
  date:        '2026-01-15',
  type:        'income',
  category:    'rent',
  amount:      8000,
  currency:    'USD',
  description: 'January rent',
};

afterEach(async () => {
  await db('transactions').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

// ---------------------------------------------------------------------------
// POST /api/transactions
// ---------------------------------------------------------------------------
describe('POST /api/transactions', () => {
  it('creates a transaction and returns 201', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    expect(res.status).toBe(201);
    expect(res.body.date).toBe('2026-01-15');
    expect(res.body.type).toBe('income');
    expect(res.body.category).toBe('rent');
    expect(parseFloat(res.body.amount)).toBe(8000);
    expect(res.body.currency).toBe('USD');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(res.body.source).toBe('manual');
    expect(res.body.hasOwnProperty('property_id')).toBe(true); // includes property_id (null if no account)
  });

  it('defaults source to manual when not provided', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    expect(res.body.source).toBe('manual');
  });

  it('accepts an explicit source', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, source: 'jyske_bank' });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('jyske_bank');
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-01-15' }); // missing type, category, amount, currency

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/type/);
  });

  it('returns 422 for invalid type', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'invalid' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/type/);
  });

  it('returns 422 when category does not match type', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'rent' }); // rent is income-only

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/category/);
  });

  it('returns 422 when amount is zero or negative', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: -100 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/amount/);
  });

  it('returns 422 when other_expense has no notes', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'other_expense' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/notes/);
  });

  it('allows other_expense when notes are provided', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'other_expense', notes: 'Miscellaneous repair' });

    expect(res.status).toBe(201);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send(VALID_TX);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/transactions
// ---------------------------------------------------------------------------
describe('GET /api/transactions', () => {
  it('returns paginated response with data, page, limit, total', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-01-01' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-03-01' });

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
    expect(res.body.total).toBe(2);
    expect(res.body.data[0].date).toBe('2026-03-01');
    expect(res.body.data[0].hasOwnProperty('property_id')).toBe(true);
    expect(res.body.data[1].date).toBe('2026-01-01');
  });

  it('supports page and limit params; total reflects full count', async () => {
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_TX, date: `2026-0${i}-01` });
    }

    const res = await request(app)
      .get('/api/transactions?page=2&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(3);
  });

  it('filters by type', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'income', category: 'rent' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'insurance' });

    const res = await request(app)
      .get('/api/transactions?type=expense')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].category).toBe('insurance');
  });

  it('filters by category', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'income', category: 'rent' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'income', category: 'heating_aconto' });

    const res = await request(app)
      .get('/api/transactions?category=heating_aconto')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].category).toBe('heating_aconto');
  });

  it('filters by date range', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-01-10' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-06-10' });

    const res = await request(app)
      .get('/api/transactions?from=2026-04-01&to=2026-12-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].date).toBe('2026-06-10');
  });

  it('filters by search term (case-insensitive description match)', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Monthly rent payment' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Water utility bill' });

    const res = await request(app)
      .get('/api/transactions?search=rent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].description).toBe('Monthly rent payment');
  });

  it('filters by reconciled=false (unreconciled only)', async () => {
    const tx1 = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Reconciled tx' });

    await request(app)
      .patch(`/api/transactions/${tx1.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reconciled: true });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Unreconciled tx' });

    const res = await request(app)
      .get('/api/transactions?reconciled=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].description).toBe('Unreconciled tx');
  });

  it('filters by reconciled=true (reconciled only)', async () => {
    const tx1 = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Reconciled tx' });

    await request(app)
      .patch(`/api/transactions/${tx1.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reconciled: true });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, description: 'Unreconciled tx' });

    const res = await request(app)
      .get('/api/transactions?reconciled=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].description).toBe('Reconciled tx');
  });

  it('sorts by property name alphabetically (F7-B1 regression)', async () => {
    const PROP_A = '00000000-0000-0000-0000-000000000081';
    const PROP_Z = '00000000-0000-0000-0000-000000000082';
    await db('properties').insert([
      { id: PROP_A, workspace_id: WORKSPACE_ID, name: 'Aardvark House', created_by: USER_ID },
      { id: PROP_Z, workspace_id: WORKSPACE_ID, name: 'Zebra Cottage',  created_by: USER_ID },
    ]).onConflict('id').ignore();

    await db('transactions').insert([
      { id: '00000000-0000-0000-0000-000000000901', workspace_id: WORKSPACE_ID, property_id: PROP_Z, date: '2026-01-01', type: 'income', category: 'rent', amount: 100, currency: 'USD', description: 'Z rent', source: 'manual', created_by: USER_ID },
      { id: '00000000-0000-0000-0000-000000000902', workspace_id: WORKSPACE_ID, property_id: PROP_A, date: '2026-01-02', type: 'income', category: 'rent', amount: 200, currency: 'USD', description: 'A rent', source: 'manual', created_by: USER_ID },
    ]);

    const asc = await request(app)
      .get('/api/transactions?sort_col=property&sort_dir=asc')
      .set('Authorization', `Bearer ${token}`);
    expect(asc.status).toBe(200);
    expect(asc.body.data[0].property_id).toBe(PROP_A);
    expect(asc.body.data[1].property_id).toBe(PROP_Z);

    const desc = await request(app)
      .get('/api/transactions?sort_col=property&sort_dir=desc')
      .set('Authorization', `Bearer ${token}`);
    expect(desc.body.data[0].property_id).toBe(PROP_Z);
    expect(desc.body.data[1].property_id).toBe(PROP_A);

    await db('properties').whereIn('id', [PROP_A, PROP_Z]).del();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/transactions/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/transactions/:id', () => {
  it('updates a field and returns the updated transaction', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated description');
    expect(res.body.type).toBe('income'); // unchanged
  });

  it('normalises currency to uppercase (same reporting currency, no rate needed)', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'usd' });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('USD');
  });

  it('returns 404 for a transaction in a different workspace', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ description: 'Hacked' });

    expect(res.status).toBe(404);
  });

  it('returns 422 when category/type mismatch on update', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', category: 'rent' }); // rent is income-only

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/category/);
  });

  it('returns 400 when no valid fields are provided', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('persists original_date on first date override', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-01-15' });

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-02-01', original_date: '2026-01-15' });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-02-01');
    expect(res.body.original_date).toBe('2026-01-15');
  });

  it('does not overwrite original_date once set', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, date: '2026-01-15' });

    await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-02-01', original_date: '2026-01-15' });

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-03-01', original_date: '2026-02-01' });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-03-01');
    expect(res.body.original_date).toBe('2026-01-15'); // first override preserved
  });

  it('persists original_amount on first amount override', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 500 });

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 750, original_amount: 500 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.amount)).toBe(750);
    expect(parseFloat(res.body.original_amount)).toBe(500);
  });

  it('does not overwrite original_amount once set', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 500 });

    await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 750, original_amount: 500 });

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 900, original_amount: 750 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.amount)).toBe(900);
    expect(parseFloat(res.body.original_amount)).toBe(500); // first override preserved
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/transactions/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/transactions/:id', () => {
  it('deletes a transaction and returns ok', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const del = await request(app)
      .delete(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  it('deleted transaction no longer appears in GET', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    await request(app)
      .delete(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.data.find(t => t.id === created.body.id)).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/transactions/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a transaction in a different workspace', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .delete(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Currency rate validation (F3-1 multi-currency)
// ---------------------------------------------------------------------------
describe('POST /api/transactions — currency rate validation', () => {
  const { WORKSPACE_ID: WS } = require('./helpers');
  const db2 = require('../src/db/knex');

  afterEach(async () => {
    await db2('currency_rates').where('workspace_id', WS).del();
  });

  it('returns 422 when currency differs from reporting_currency and no rate exists', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, currency: 'DKK' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/DKK/);
  });

  it('accepts a non-reporting currency when a valid rate exists', async () => {
    await db2('currency_rates').insert({
      workspace_id: WS,
      from_currency: 'DKK',
      to_currency: 'USD',
      effective_date: '2026-01-01',
      rate: 0.14,
      source: 'manual',
    });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, currency: 'DKK', date: '2026-01-15' });

    expect(res.status).toBe(201);
    expect(res.body.resolved_rate).toBeCloseTo(0.14);
    expect(res.body.reporting_currency).toBe('USD');
  });

  it('returns 422 when rate exists but only for a later date', async () => {
    await db2('currency_rates').insert({
      workspace_id: WS,
      from_currency: 'DKK',
      to_currency: 'USD',
      effective_date: '2026-06-01',
      rate: 0.14,
      source: 'manual',
    });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, currency: 'DKK', date: '2026-01-15' });

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /api/transactions/import (F3-4)
// ---------------------------------------------------------------------------
describe('POST /api/transactions/import', () => {
  const BATCH_ROW = {
    date:        '2026-03-01',
    type:        'income',
    category:    'rent',
    amount:      1500,
    currency:    'USD',
    description: 'March rent',
    source:      'jyske_bank',
  };

  it('inserts all rows and returns 201 with inserted count and import_batch UUID', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, description: 'April rent', date: '2026-04-01' }]);

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(2);
    expect(typeof res.body.import_batch).toBe('string');
    expect(res.body.import_batch).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('all inserted rows share the same import_batch', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, date: '2026-04-01' }]);

    expect(res.status).toBe(201);
    const { import_batch } = res.body;

    const rows = await db('transactions').where({ import_batch }).select('id');
    expect(rows.length).toBe(2);
  });

  it('returns 422 with per-row errors when any row fails validation', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([
        BATCH_ROW,
        { ...BATCH_ROW, type: 'invalid_type' },
        { ...BATCH_ROW, amount: -50 },
      ]);

    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.errors)).toBe(true);
    const rowNums = res.body.errors.map(e => e.row);
    expect(rowNums).toContain(1);
    expect(rowNums).toContain(2);
  });

  it('inserts nothing when any row fails validation (all-or-nothing)', async () => {
    const countBefore = await db('transactions').where('workspace_id', WORKSPACE_ID).count('id as n').first();

    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, amount: -1 }]);

    const countAfter = await db('transactions').where('workspace_id', WORKSPACE_ID).count('id as n').first();
    expect(parseInt(countAfter.n, 10)).toBe(parseInt(countBefore.n, 10));
  });

  it('returns 400 for an empty array', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([]);

    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-array body', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [BATCH_ROW] });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .send([BATCH_ROW]);

    expect(res.status).toBe(401);
  });

  it('returns 422 when any row has a currency with no rate', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, currency: 'DKK' }]);

    expect(res.status).toBe(422);
    expect(res.body.errors[0].row).toBe(1);
    expect(res.body.errors[0].errors[0]).toMatch(/DKK/);
  });

  it('uses row source field when provided', async () => {
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ...BATCH_ROW, source: 'nordea_dk' }]);

    expect(res.status).toBe(201);
    const [row] = await db('transactions').where({ import_batch: res.body.import_batch });
    expect(row.source).toBe('nordea_dk');
  });

  it('defaults source to "import" when not provided', async () => {
    const { source: _s, ...rowNoSource } = BATCH_ROW;
    const res = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([rowNoSource]);

    expect(res.status).toBe(201);
    const [row] = await db('transactions').where({ import_batch: res.body.import_batch });
    expect(row.source).toBe('import');
  });
});

// ---------------------------------------------------------------------------
// GET /api/transactions/import/history + DELETE /api/transactions/import/:batch_id (F3-5)
// ---------------------------------------------------------------------------
describe('GET /api/transactions/import/history', () => {
  const BATCH_ROW = {
    date: '2026-03-01', type: 'income', category: 'rent',
    amount: 1500, currency: 'USD', description: 'March rent', source: 'jyske_bank',
  };

  it('returns empty array when no batches exist', async () => {
    const res = await request(app)
      .get('/api/transactions/import/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns batch metadata after an import', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, date: '2026-03-02' }]);

    const res = await request(app)
      .get('/api/transactions/import/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].row_count).toBe(2);
    expect(res.body[0].source).toBe('jyske_bank');
    expect(typeof res.body[0].import_batch).toBe('string');
    expect(typeof res.body[0].imported_at).toBe('string');
    expect(res.body[0]).toHaveProperty('properties'); // null when no account_id/property linked
  });

  it('returns most recent batch first', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW]);
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ...BATCH_ROW, source: 'nordea_dk', date: '2026-04-01' }]);

    const res = await request(app)
      .get('/api/transactions/import/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].source).toBe('nordea_dk');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/transactions/import/history');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/transactions/import/:batch_id', () => {
  const BATCH_ROW = {
    date: '2026-03-01', type: 'income', category: 'rent',
    amount: 1500, currency: 'USD', description: 'March rent', source: 'jyske_bank',
  };

  it('deletes all rows in the batch and returns count', async () => {
    const imp = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW, { ...BATCH_ROW, date: '2026-03-02' }]);

    const res = await request(app)
      .delete(`/api/transactions/import/${imp.body.import_batch}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
  });

  it('removes rolled-back rows from history', async () => {
    const imp = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW]);

    await request(app)
      .delete(`/api/transactions/import/${imp.body.import_batch}`)
      .set('Authorization', `Bearer ${token}`);

    const history = await request(app)
      .get('/api/transactions/import/history')
      .set('Authorization', `Bearer ${token}`);

    expect(history.body).toEqual([]);
  });

  it('returns 404 for an unknown batch_id', async () => {
    const res = await request(app)
      .delete('/api/transactions/import/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('cannot delete a batch from another workspace', async () => {
    const imp = await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BATCH_ROW]);

    const { makeToken } = require('./helpers');
    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app)
      .delete(`/api/transactions/import/${imp.body.import_batch}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .delete('/api/transactions/import/some-batch-id');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/transactions/import/check (F5-12)
// ---------------------------------------------------------------------------
describe('POST /api/transactions/import/check', () => {
  const PROP_ID = '00000000-0000-0000-0000-000000000077';

  beforeEach(async () => {
    await db('properties').insert({
      id: PROP_ID,
      workspace_id: WORKSPACE_ID,
      name: 'Dup Test Property',
      created_by: USER_ID,
    }).onConflict('id').ignore();
  });

  afterEach(async () => {
    await db('properties').where('id', PROP_ID).del();
  });

  const BASE_ROW = {
    date: '2026-03-01', type: 'income', category: 'rent',
    amount: 1500, currency: 'USD', description: 'March rent',
    raw_description: 'March rent', property_id: PROP_ID,
  };

  it('returns 400 for a non-array body', async () => {
    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: PROP_ID, date: '2026-03-01', description: 'x', amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/transactions/import/check').send([]);
    expect(res.status).toBe(401);
  });

  it('returns empty array for empty input', async () => {
    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns null when no matching transaction exists', async () => {
    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 1500 }]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([null]);
  });

  it('returns match object when all four key fields match', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 1500 }]);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).not.toBeNull();
    expect(res.body[0].date).toBe('2026-03-01');
    expect(parseFloat(res.body[0].amount)).toBe(1500);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('created_at');
    expect(res.body[0]).toHaveProperty('import_batch');
  });

  it('description match is case-insensitive', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'MARCH RENT', amount: 1500 }]);

    expect(res.body[0]).not.toBeNull();
  });

  it('returns null when amount differs', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 9999 }]);

    expect(res.body[0]).toBeNull();
  });

  it('returns null when date differs', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-04-01', description: 'March rent', amount: 1500 }]);

    expect(res.body[0]).toBeNull();
  });

  it('returns null when property_id differs', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: '00000000-0000-0000-0000-000000000098', date: '2026-03-01', description: 'March rent', amount: 1500 }]);

    expect(res.body[0]).toBeNull();
  });

  it('does not match transactions from another workspace', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${otherToken}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 1500 }]);

    expect(res.body[0]).toBeNull();
  });

  it('returns most recently created match when multiple exist', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([{ ...BASE_ROW, notes: 'second import' }]);

    const txs = await db('transactions').where({ workspace_id: WORKSPACE_ID }).orderBy('created_at', 'desc');

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 1500 }]);

    expect(res.body[0]).not.toBeNull();
    expect(res.body[0].id).toBe(txs[0].id);
  });

  it('returns null for row missing property_id', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([{ date: '2026-03-01', description: 'March rent', amount: 1500 }]);

    expect(res.body[0]).toBeNull();
  });

  it('handles mixed matches and nulls across multiple rows', async () => {
    await request(app)
      .post('/api/transactions/import')
      .set('Authorization', `Bearer ${token}`)
      .send([BASE_ROW]);

    const res = await request(app)
      .post('/api/transactions/import/check')
      .set('Authorization', `Bearer ${token}`)
      .send([
        { property_id: PROP_ID, date: '2026-03-01', description: 'March rent', amount: 1500 },
        { property_id: PROP_ID, date: '2026-03-01', description: 'No match here', amount: 500 },
      ]);

    expect(res.body[0]).not.toBeNull();
    expect(res.body[1]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/transactions/:id (F3-17)
// ---------------------------------------------------------------------------
describe('GET /api/transactions/:id', () => {
  it('returns a transaction with split_count=0 for a leaf', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .get(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.split_count).toBe(0);
    expect(res.body.parent_transaction_id).toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/transactions/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/transactions/00000000-0000-0000-0000-000000000099');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/transactions — split_count field (F3-17)
// ---------------------------------------------------------------------------
describe('GET /api/transactions — split_count', () => {
  it('includes split_count=0 for leaf transactions', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('split_count', 0);
  });

  it('includes split_count=2 for a transaction with two children', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'Part A', amount: 600 },
        { type: 'income', category: 'rent', description: 'Part B', amount: 400 },
      ]);

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const parentRow = res.body.data.find(t => t.id === parent.body.id);
    expect(parentRow.split_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/transactions/:id/splits (F3-17)
// ---------------------------------------------------------------------------
describe('PUT /api/transactions/:id/splits', () => {
  it('creates children and returns parent + children', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    const res = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent',          description: 'Rent portion',    amount: 700 },
        { type: 'income', category: 'heating_aconto', description: 'Heating portion', amount: 300 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.parent.id).toBe(parent.body.id);
    expect(res.body.children.length).toBe(2);
    expect(parseFloat(res.body.children[0].amount) + parseFloat(res.body.children[1].amount)).toBeCloseTo(1000);
  });

  it('children inherit date, currency, and account_id from parent', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000, date: '2026-03-01' });

    const res = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'A', amount: 500 },
        { type: 'income', category: 'rent', description: 'B', amount: 500 },
      ]);

    expect(res.status).toBe(200);
    for (const child of res.body.children) {
      expect(child.date).toBe('2026-03-01');
      expect(child.currency).toBe('USD');
      expect(child.parent_transaction_id).toBe(parent.body.id);
    }
  });

  it('atomically replaces existing children on re-split', async () => {
    // Seed parent + first split directly to DB to avoid 3 sequential HTTP calls
    const [parent] = await db('transactions').insert({
      workspace_id: WORKSPACE_ID, date: '2026-01-15', type: 'income', category: 'rent',
      amount: 1000, currency: 'USD', source: 'manual', created_by: USER_ID, last_modified_by: USER_ID,
    }).returning('*');
    await db('transactions').insert([
      { workspace_id: WORKSPACE_ID, parent_transaction_id: parent.id, date: '2026-01-15',
        type: 'income', category: 'rent', amount: 500, currency: 'USD', source: 'manual',
        description: 'A', created_by: USER_ID, last_modified_by: USER_ID },
      { workspace_id: WORKSPACE_ID, parent_transaction_id: parent.id, date: '2026-01-15',
        type: 'income', category: 'rent', amount: 500, currency: 'USD', source: 'manual',
        description: 'B', created_by: USER_ID, last_modified_by: USER_ID },
    ]);

    const res = await request(app)
      .put(`/api/transactions/${parent.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent',           description: 'X', amount: 200 },
        { type: 'income', category: 'heating_aconto', description: 'Y', amount: 300 },
        { type: 'income', category: 'rent',           description: 'Z', amount: 500 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.children.length).toBe(3);

    const allChildren = await db('transactions').where({ parent_transaction_id: parent.id });
    expect(allChildren.length).toBe(3);
  });

  it('returns 422 when amounts do not sum to parent amount', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    const res = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'A', amount: 400 },
        { type: 'income', category: 'rent', description: 'B', amount: 400 },
      ]);

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/sum/);
  });

  it('returns 400 when fewer than 2 children are provided', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    const res = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([{ type: 'income', category: 'rent', description: 'A', amount: 1000 }]);

    expect(res.status).toBe(400);
  });

  it('returns 422 when a child has an invalid category for its type', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    const res = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'expense', category: 'rent', description: 'A', amount: 500 }, // rent is income-only
        { type: 'income',  category: 'rent', description: 'B', amount: 500 },
      ]);

    expect(res.status).toBe(422);
    expect(res.body.errors[0].row).toBe(0);
  });

  it('returns 422 when parent is itself a child transaction', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    const splitRes = await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'A', amount: 600 },
        { type: 'income', category: 'rent', description: 'B', amount: 400 },
      ]);

    const childId = splitRes.body.children[0].id;

    const res = await request(app)
      .put(`/api/transactions/${childId}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'X', amount: 300 },
        { type: 'income', category: 'rent', description: 'Y', amount: 300 },
      ]);

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/child/);
  });

  it('returns 404 for unknown transaction id', async () => {
    const res = await request(app)
      .put('/api/transactions/00000000-0000-0000-0000-000000000099/splits')
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'A', amount: 500 },
        { type: 'income', category: 'rent', description: 'B', amount: 500 },
      ]);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/transactions/00000000-0000-0000-0000-000000000099/splits')
      .send([]);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/transactions/:id/splits (F3-17)
// ---------------------------------------------------------------------------
describe('DELETE /api/transactions/:id/splits', () => {
  it('removes all children and returns deleted count', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: 1000 });

    await request(app)
      .put(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`)
      .send([
        { type: 'income', category: 'rent', description: 'A', amount: 600 },
        { type: 'income', category: 'rent', description: 'B', amount: 400 },
      ]);

    const res = await request(app)
      .delete(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);

    const remaining = await db('transactions').where({ parent_transaction_id: parent.body.id });
    expect(remaining.length).toBe(0);
  });

  it('returns deleted=0 when transaction has no children', async () => {
    const parent = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .delete(`/api/transactions/${parent.body.id}/splits`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(0);
  });

  it('deleting parent cascades to children', async () => {
    // Seed parent + children directly to DB
    const [parent] = await db('transactions').insert({
      workspace_id: WORKSPACE_ID, date: '2026-01-15', type: 'income', category: 'rent',
      amount: 1000, currency: 'USD', source: 'manual', created_by: USER_ID, last_modified_by: USER_ID,
    }).returning('*');
    await db('transactions').insert([
      { workspace_id: WORKSPACE_ID, parent_transaction_id: parent.id, date: '2026-01-15',
        type: 'income', category: 'rent', amount: 600, currency: 'USD', source: 'manual',
        description: 'A', created_by: USER_ID, last_modified_by: USER_ID },
      { workspace_id: WORKSPACE_ID, parent_transaction_id: parent.id, date: '2026-01-15',
        type: 'income', category: 'rent', amount: 400, currency: 'USD', source: 'manual',
        description: 'B', created_by: USER_ID, last_modified_by: USER_ID },
    ]);

    await request(app)
      .delete(`/api/transactions/${parent.id}`)
      .set('Authorization', `Bearer ${token}`);

    const orphans = await db('transactions').where({ parent_transaction_id: parent.id });
    expect(orphans.length).toBe(0);
  });

  it('returns 404 for unknown transaction id', async () => {
    const res = await request(app)
      .delete('/api/transactions/00000000-0000-0000-0000-000000000099/splits')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .delete('/api/transactions/00000000-0000-0000-0000-000000000099/splits');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/transactions/:id — currency rate validation', () => {
  const { WORKSPACE_ID: WS } = require('./helpers');
  const db2 = require('../src/db/knex');

  afterEach(async () => {
    await db2('currency_rates').where('workspace_id', WS).del();
  });

  it('returns 422 when changing currency to one with no rate', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'DKK' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/DKK/);
  });

  it('accepts currency change when a valid rate exists', async () => {
    await db2('currency_rates').insert({
      workspace_id: WS,
      from_currency: 'DKK',
      to_currency: 'USD',
      effective_date: '2026-01-01',
      rate: 0.14,
      source: 'manual',
    });

    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'DKK' });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('DKK');
    expect(res.body.resolved_rate).toBeCloseTo(0.14);
  });
});
