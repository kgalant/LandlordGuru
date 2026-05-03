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
  await db('description_mappings').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

const VALID_MAPPING = {
  keyword:      'Monthly rent from tenant',
  category:     'rent',
  bank_profile: 'jyske_bank',
};

// ---------------------------------------------------------------------------
// POST /api/description-mappings
// ---------------------------------------------------------------------------
describe('POST /api/description-mappings', () => {
  it('creates a user-specific mapping and returns 201', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    expect(res.status).toBe(201);
    expect(res.body.keyword).toBe('Monthly rent from tenant');
    expect(res.body.category).toBe('rent');
    expect(res.body.bank_profile).toBe('jyske_bank');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(res.body.user_id).toBe(USER_ID);
  });

  it('trims the keyword', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, keyword: '  rent payment  ' });

    expect(res.status).toBe(201);
    expect(res.body.keyword).toBe('rent payment');
  });

  it('creates a global (workspace-wide) mapping when scope is global', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, scope: 'global' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBeNull();
  });

  it('defaults bank_profile to empty string when not provided', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'insurance', category: 'insurance' });

    expect(res.status).toBe(201);
    expect(res.body.bank_profile).toBe('');
  });

  it('upserts (updates) an existing user mapping with same keyword+bank_profile, returns 200', async () => {
    await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, category: 'insurance' });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('insurance');

    const all = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.length).toBe(1);
  });

  it('upserts a global mapping independently of a user mapping with same key', async () => {
    await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, scope: 'global' });

    expect(res.status).toBe(201);

    const all = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.length).toBe(2);
  });

  it('returns 400 when keyword is missing', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'rent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/keyword/);
  });

  it('returns 400 when category is missing', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });


  it('returns 400 for property_id not in workspace', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, property_id: '00000000-0000-0000-0000-000000000099' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/property_id/);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/description-mappings')
      .send(VALID_MAPPING);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/description-mappings
// ---------------------------------------------------------------------------
describe('GET /api/description-mappings', () => {
  it('returns user-specific mappings for the current user', async () => {
    await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    const res = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].user_id).toBe(USER_ID);
  });

  it('returns global (workspace-wide) mappings alongside user-specific ones', async () => {
    await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, keyword: 'global keyword', scope: 'global' });

    const res = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    const nullUser = res.body.find(m => m.user_id === null);
    const ownUser  = res.body.find(m => m.user_id === USER_ID);
    expect(nullUser).toBeDefined();
    expect(ownUser).toBeDefined();
  });

  it('does not return another user\'s mappings', async () => {
    const otherUserId = '00000000-0000-0000-0000-000000000099';
    // Insert directly so no FK dependency on a seeded user
    await db('description_mappings').insert({
      workspace_id: WORKSPACE_ID,
      user_id: USER_ID,    // owned by main user
      bank_profile: 'jyske_bank',
      keyword: 'some keyword',
      category: 'rent',
      created_by: USER_ID,
      updated_by: USER_ID,
    });

    // Fetch as a different user — should not see the main user's mapping
    const otherToken = makeToken({ user_id: otherUserId });
    const res = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('returns empty array when no mappings exist', async () => {
    const res = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/description-mappings');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/description-mappings/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/description-mappings/:id', () => {
  it('deletes own mapping and returns ok', async () => {
    const created = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    const del = await request(app)
      .delete(`/api/description-mappings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  it('deleted mapping no longer appears in GET', async () => {
    const created = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    await request(app)
      .delete(`/api/description-mappings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.find(m => m.id === created.body.id)).toBeUndefined();
  });

  it('allows deleting a global mapping', async () => {
    const created = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_MAPPING, scope: 'global' });

    const del = await request(app)
      .delete(`/api/description-mappings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
  });

  it('returns 403 when trying to delete another user\'s mapping', async () => {
    // Insert a mapping owned by USER_ID directly so no FK dependency on a seeded second user
    const [mapping] = await db('description_mappings').insert({
      workspace_id: WORKSPACE_ID,
      user_id:      USER_ID,
      bank_profile: 'jyske_bank',
      keyword:      'owned by main user',
      category:     'rent',
      created_by:   USER_ID,
      updated_by:   USER_ID,
    }).returning('*');

    // Attempt delete as a different user whose JWT is valid but doesn't own the mapping
    const otherToken = makeToken({ user_id: '00000000-0000-0000-0000-000000000099' });
    const res = await request(app)
      .delete(`/api/description-mappings/${mapping.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/description-mappings/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a mapping in a different workspace', async () => {
    const created = await request(app)
      .post('/api/description-mappings')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_MAPPING);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .delete(`/api/description-mappings/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .delete('/api/description-mappings/00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(401);
  });
});
