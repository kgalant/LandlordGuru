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

const VALID_TX = {
  date:        '2026-01-15',
  type:        'income',
  category:    'rent',
  amount:      8000,
  currency:    'DKK',
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
    expect(res.body.currency).toBe('DKK');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(res.body.source).toBe('manual');
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

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-01-15' }); // missing type, category, amount, currency

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/);
  });

  it('returns 400 for invalid type', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/);
  });

  it('returns 400 when category does not match type', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'rent' }); // rent is income-only

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });

  it('returns 400 when amount is zero or negative', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, amount: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/);
  });

  it('returns 400 when other_expense has no notes', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_TX, type: 'expense', category: 'other_expense' });

    expect(res.status).toBe(400);
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
  it('returns transactions sorted newest first', async () => {
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
    expect(res.body.length).toBe(2);
    expect(res.body[0].date).toBe('2026-03-01');
    expect(res.body[1].date).toBe('2026-01-01');
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
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('insurance');
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
    expect(res.body.length).toBe(1);
    expect(res.body[0].date).toBe('2026-06-10');
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

  it('normalises currency to uppercase', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'pln' });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('PLN');
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

  it('returns 400 when category/type mismatch on update', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_TX);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', category: 'rent' }); // rent is income-only

    expect(res.status).toBe(400);
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

    expect(list.body.find(t => t.id === created.body.id)).toBeUndefined();
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
