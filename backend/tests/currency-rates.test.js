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
  await db('currency_rates').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

const VALID_RATE = {
  from_currency: 'USD',
  to_currency:   'SGD',
  effective_date: '2026-01-01',
  rate:           1.35,
};

// ---------------------------------------------------------------------------
// POST /api/currency-rates
// ---------------------------------------------------------------------------
describe('POST /api/currency-rates', () => {
  it('creates a rate and returns 201', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    expect(res.status).toBe(201);
    expect(res.body.from_currency).toBe('USD');
    expect(res.body.to_currency).toBe('SGD');
    expect(res.body.effective_date).toMatch(/2026-01-01/);
    expect(parseFloat(res.body.rate)).toBeCloseTo(1.35);
    expect(res.body.source).toBe('manual');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
  });

  it('accepts source=auto', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, source: 'auto' });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('auto');
  });

  it('normalises currency codes to uppercase', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, from_currency: 'usd', to_currency: 'sgd' });

    expect(res.status).toBe(201);
    expect(res.body.from_currency).toBe('USD');
    expect(res.body.to_currency).toBe('SGD');
  });

  it('returns 400 when from_currency is missing', async () => {
    const { from_currency, ...rest } = VALID_RATE;
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/from_currency/);
  });

  it('returns 400 when to_currency is missing', async () => {
    const { to_currency, ...rest } = VALID_RATE;
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/to_currency/);
  });

  it('returns 400 when effective_date is missing', async () => {
    const { effective_date, ...rest } = VALID_RATE;
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effective_date/);
  });

  it('returns 400 when rate is missing', async () => {
    const { rate, ...rest } = VALID_RATE;
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rate/);
  });

  it('returns 400 when rate is zero or negative', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, rate: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rate/);
  });

  it('returns 400 when from and to currencies are the same', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, to_currency: 'USD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/);
  });

  it('returns 400 for invalid source', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, source: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source/);
  });

  it('returns 409 for duplicate pair+date', async () => {
    await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    const res = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/currency-rates')
      .send(VALID_RATE);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/currency-rates
// ---------------------------------------------------------------------------
describe('GET /api/currency-rates', () => {
  it('returns all rates for the workspace ordered by pair then date desc', async () => {
    await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, effective_date: '2026-01-01', rate: 1.35 });

    await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RATE, effective_date: '2026-02-01', rate: 1.36 });

    const res = await request(app)
      .get('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Most recent first
    expect(res.body[0].effective_date).toMatch(/2026-02-01/);
    expect(res.body[1].effective_date).toMatch(/2026-01-01/);
  });

  it('does not return rates from a different workspace', async () => {
    await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app)
      .get('/api/currency-rates')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/currency-rates');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/currency-rates/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/currency-rates/:id', () => {
  it('deletes a rate and returns ok', async () => {
    const created = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    const del = await request(app)
      .delete(`/api/currency-rates/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  it('deleted rate no longer appears in GET', async () => {
    const created = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    await request(app)
      .delete(`/api/currency-rates/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.find(r => r.id === created.body.id)).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/currency-rates/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when rate belongs to a different workspace', async () => {
    const created = await request(app)
      .post('/api/currency-rates')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RATE);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app)
      .delete(`/api/currency-rates/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .delete('/api/currency-rates/00000000-0000-0000-0000-000000000099');

    expect(res.status).toBe(401);
  });
});
