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
