require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, USER_ID } = require('./helpers');

const token = makeToken();

const VALID_RULE = {
  keyword:      'tenant rent payment',
  category:     'rent',
  bank_profile: 'jyske_bank',
};

afterEach(async () => {
  await db('rules').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

// ---------------------------------------------------------------------------
// POST /api/rules
// ---------------------------------------------------------------------------
describe('POST /api/rules', () => {
  it('creates a rule and returns 201', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    expect(res.status).toBe(201);
    expect(res.body.keyword).toBe('tenant rent payment');
    expect(res.body.category).toBe('rent');
    expect(res.body.bank_profile).toBe('jyske_bank');
    expect(res.body.workspace_id).toBe(WORKSPACE_ID);
    expect(res.body.sort_order).toBe(0); // default
  });

  it('trims keyword and bank_profile', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        keyword:      '  tenant rent  ',
        category:     'rent',
        bank_profile: '  jyske_bank  ',
      });

    expect(res.status).toBe(201);
    expect(res.body.keyword).toBe('tenant rent');
    expect(res.body.bank_profile).toBe('jyske_bank');
  });

  it('allows null bank_profile', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        keyword:  'maintenance',
        category: 'maintenance_repair',
        bank_profile: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.bank_profile).toBeNull();
  });

  it('allows custom sort_order', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        keyword:     'insurance',
        category:    'insurance',
        sort_order:  5,
      });

    expect(res.status).toBe(201);
    expect(res.body.sort_order).toBe(5);
  });

  it('returns 400 when required keyword is missing', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'rent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/keyword/);
  });

  it('returns 400 when required category is missing', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RULE, category: 'invalid_category' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });

  it('accepts all valid categories', async () => {
    const validCategories = [
      'rent', 'heating_aconto', 'heating_settlement',
      'maintenance_repair', 'property_tax', 'insurance', 'utilities',
      'management_fee', 'advertising', 'professional_fees', 'bank_charges', 'other_expense',
      'deposit_received', 'deposit_returned',
      'inter_account',
    ];

    for (const category of validCategories) {
      const res = await request(app)
        .post('/api/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          keyword: `test ${category}`,
          category,
        });

      expect(res.status).toBe(201);
      expect(res.body.category).toBe(category);
    }
  });

  it('returns 400 for property_id that does not exist in workspace', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...VALID_RULE,
        property_id: '00000000-0000-0000-0000-000000000099',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/property_id/);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/rules')
      .send(VALID_RULE);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/rules
// ---------------------------------------------------------------------------
describe('GET /api/rules', () => {
  it('returns all rules sorted by sort_order', async () => {
    await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'first', category: 'rent', sort_order: 2 });

    await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'second', category: 'insurance', sort_order: 1 });

    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].keyword).toBe('second');   // sort_order 1 comes first
    expect(res.body[1].keyword).toBe('first');    // sort_order 2 comes second
  });

  it('filters by bank_profile', async () => {
    await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'jyske', category: 'rent', bank_profile: 'jyske_bank' });

    await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'nordea', category: 'insurance', bank_profile: 'nordea_dk' });

    const res = await request(app)
      .get('/api/rules?bank_profile=jyske_bank')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].bank_profile).toBe('jyske_bank');
  });

  it('includes rules with null bank_profile in unfiltered results', async () => {
    await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'generic', category: 'rent' });

    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].bank_profile).toBeNull();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/rules/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/rules/:id', () => {
  it('updates a field and returns the updated rule', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: 'new keyword' });

    expect(res.status).toBe(200);
    expect(res.body.keyword).toBe('new keyword');
    expect(res.body.category).toBe('rent'); // unchanged
  });

  it('updates category to a valid category', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'insurance' });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe('insurance');
  });

  it('updates sort_order', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sort_order: 10 });

    expect(res.status).toBe(200);
    expect(res.body.sort_order).toBe(10);
  });

  it('returns 404 for a rule in a different workspace', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ keyword: 'hacked' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when updating to an invalid category', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'invalid_category' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });

  it('returns 400 when no valid fields are provided', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const res = await request(app)
      .patch(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid fields/);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/rules/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/rules/:id', () => {
  it('deletes a rule and returns ok', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const del = await request(app)
      .delete(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
  });

  it('deleted rule no longer appears in GET', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    await request(app)
      .delete(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.find(r => r.id === created.body.id)).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/rules/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a rule in a different workspace', async () => {
    const created = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE);

    const otherToken = makeToken({ workspace_id: '00000000-0000-0000-0000-000000000099' });

    const res = await request(app)
      .delete(`/api/rules/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});
