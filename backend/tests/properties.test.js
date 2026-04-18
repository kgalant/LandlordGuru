require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, setupAppWithDb } = require('./helpers');

const token = makeToken();

// Set up app with db for logging middleware
beforeAll(() => {
  setupAppWithDb(app, db);
});

const VALID_PROPERTY = {
  name:     'VB77 1tv',
  country:  'DK',
  currency: 'DKK',
  model:    'longterm',
  rent:     8000,
  tenant:   'Test Tenant',
};

afterEach(async () => {
  // Clean up in dependency order so FK constraints don't complain
  await db('account_properties').del();
  await db('accounts').where('workspace_id', WORKSPACE_ID).del();
  await db('properties').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

// ---------------------------------------------------------------------------
// POST /api/properties
// ---------------------------------------------------------------------------
describe('POST /api/properties', () => {
  it('creates a property and returns 201', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('VB77 1tv');
    expect(res.body.country).toBe('DK');
    expect(res.body.currency).toBe('DKK');
    expect(res.body.model).toBe('longterm');
    expect(res.body.active).toBe(true);
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
  });

  it('auto-creates a matching account', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    const account = await db('accounts')
      .where({ workspace_id: WORKSPACE_ID, name: 'VB77 1tv' })
      .first();

    expect(account).toBeDefined();
    expect(account.is_default).toBe(false);

    const link = await db('account_properties')
      .where({ property_id: res.body.id, account_id: account.id })
      .first();

    expect(link).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Incomplete' }); // missing country, currency, model

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/country/);
  });

  it('returns 400 for invalid model', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_PROPERTY, model: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/model/);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/properties')
      .send(VALID_PROPERTY);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/properties
// ---------------------------------------------------------------------------
describe('GET /api/properties', () => {
  it('returns active properties sorted by name', async () => {
    await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_PROPERTY, name: 'ZZZ Property' });

    await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_PROPERTY, name: 'AAA Property' });

    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].name).toBe('AAA Property');
    expect(res.body[1].name).toBe('ZZZ Property');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/properties');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/properties/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/properties/:id', () => {
  it('updates a field and returns the updated property', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    const res = await request(app)
      .patch(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rent: 9000 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.rent)).toBe(9000);
    expect(res.body.name).toBe('VB77 1tv'); // unchanged
  });

  it('returns 404 for a property in a different workspace', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .patch(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ rent: 9000 });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid model', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    const res = await request(app)
      .patch(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'invalid' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/properties/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/properties/:id', () => {
  it('soft-deletes a property (active = false)', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    const del = await request(app)
      .delete(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  it('deleted property no longer appears in GET', async () => {
    const created = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_PROPERTY);

    await request(app)
      .delete(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.find(p => p.id === created.body.id)).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/properties/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
