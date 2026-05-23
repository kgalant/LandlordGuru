require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db/knex');
const { makeToken, WORKSPACE_ID, USER_ID, setupAppWithDb } = require('./helpers');

const token = makeToken();

const ACCOUNT_A_ID = '00000000-0000-0000-0000-000000000010';
const ACCOUNT_B_ID = '00000000-0000-0000-0000-000000000011'; // child of A
const PROPERTY_ID  = '00000000-0000-0000-0000-000000000020';

beforeAll(() => {
  setupAppWithDb(app, db);
});

afterEach(async () => {
  await db('transactions').where('workspace_id', WORKSPACE_ID).del();
  await db('account_properties').whereIn('account_id', [ACCOUNT_A_ID, ACCOUNT_B_ID]).del();
  await db('accounts').whereIn('id', [ACCOUNT_A_ID, ACCOUNT_B_ID]).del();
  await db('properties').where('id', PROPERTY_ID).del();
});

function tx(overrides = {}) {
  return {
    workspace_id:     WORKSPACE_ID,
    date:             '2026-03-15',
    type:             'income',
    category:         'rent',
    amount:           10000,
    currency:         'DKK',
    created_by:       USER_ID,
    last_modified_by: USER_ID,
    ...overrides,
  };
}

async function insertAccount(id, overrides = {}) {
  await db('accounts').insert({
    id,
    workspace_id:     WORKSPACE_ID,
    name:             `Test Account ${id.slice(-4)}`,
    is_default:       false,
    is_active:        true,
    created_by:       USER_ID,
    last_modified_by: USER_ID,
    ...overrides,
  });
}

async function insertProperty() {
  await db('properties').insert({
    id:               PROPERTY_ID,
    workspace_id:     WORKSPACE_ID,
    name:             'Test Property',
    country:          'DK',
    currency:         'DKK',
    model:            'longterm',
    created_by:       USER_ID,
    last_modified_by: USER_ID,
  });
}

// ---------------------------------------------------------------------------
describe('GET /api/reports/pnl', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/reports/pnl');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid from date', async () => {
    const res = await request(app)
      .get('/api/reports/pnl?from=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid to date', async () => {
    const res = await request(app)
      .get('/api/reports/pnl?to=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns empty result when no transactions exist', async () => {
    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.income).toEqual([]);
    expect(res.body.expenses).toEqual([]);
    expect(res.body.deposits).toEqual([]);
  });

  it('returns income grouped by category and currency', async () => {
    await db('transactions').insert([
      tx({ category: 'rent',           amount: 10000, currency: 'DKK' }),
      tx({ category: 'rent',           amount:   500, currency: 'EUR' }),
      tx({ category: 'heating_aconto', amount:  1000, currency: 'DKK' }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(3);

    const rentDKK = res.body.income.find(r => r.category === 'rent' && r.currency === 'DKK');
    expect(rentDKK.amount).toBe(10000);

    const rentEUR = res.body.income.find(r => r.category === 'rent' && r.currency === 'EUR');
    expect(rentEUR.amount).toBe(500);
  });

  it('sums multiple transactions in the same category+currency bucket', async () => {
    await db('transactions').insert([
      tx({ amount: 10000 }),
      tx({ amount:  5000 }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(15000);
  });

  it('returns expenses grouped by category', async () => {
    await db('transactions').insert([
      tx({ type: 'expense', category: 'maintenance_repair', amount: 500  }),
      tx({ type: 'expense', category: 'insurance',          amount: 200  }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toEqual([]);
    expect(res.body.expenses).toHaveLength(2);
    const m = res.body.expenses.find(r => r.category === 'maintenance_repair');
    expect(m.amount).toBe(500);
  });

  it('excludes transfer transactions', async () => {
    await db('transactions').insert([
      tx({ type: 'income',   category: 'rent',          amount: 10000 }),
      tx({ type: 'transfer', category: 'inter_account', amount:  5000 }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.expenses).toHaveLength(0);
    const all = [...res.body.income, ...res.body.expenses, ...res.body.deposits];
    expect(all.some(r => r.category === 'inter_account')).toBe(false);
  });

  it('filters by from date (inclusive)', async () => {
    await db('transactions').insert([
      tx({ date: '2026-01-15', amount: 1000 }),
      tx({ date: '2026-03-15', amount: 2000 }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl?from=2026-02-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(2000);
  });

  it('filters by to date (inclusive)', async () => {
    await db('transactions').insert([
      tx({ date: '2026-01-15', amount: 1000 }),
      tx({ date: '2026-03-15', amount: 2000 }),
    ]);

    const res = await request(app)
      .get('/api/reports/pnl?to=2026-02-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(1000);
  });

  it('filters by property_id (direct column)', async () => {
    await insertProperty();
    await db('transactions').insert([
      tx({ property_id: PROPERTY_ID, amount: 5000 }),
      tx({ property_id: null,        amount: 3000 }),
    ]);

    const res = await request(app)
      .get(`/api/reports/pnl?property_id=${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(5000);
    expect(res.body.filters.property_id).toBe(PROPERTY_ID);
  });

  it('filters by property_id via account_properties join', async () => {
    await insertProperty();
    await insertAccount(ACCOUNT_A_ID);
    await db('account_properties').insert({ account_id: ACCOUNT_A_ID, property_id: PROPERTY_ID });
    await db('transactions').insert([
      tx({ account_id: ACCOUNT_A_ID, property_id: null, amount: 7000 }),
      tx({ account_id: null,          property_id: null, amount: 2000 }),
    ]);

    const res = await request(app)
      .get(`/api/reports/pnl?property_id=${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(7000);
  });

  it('filters by account_id with exact scope', async () => {
    await insertAccount(ACCOUNT_A_ID);
    await insertAccount(ACCOUNT_B_ID, { parent_account_id: ACCOUNT_A_ID });
    await db('transactions').insert([
      tx({ account_id: ACCOUNT_A_ID, amount: 5000 }),
      tx({ account_id: ACCOUNT_B_ID, amount: 3000 }),
    ]);

    const res = await request(app)
      .get(`/api/reports/pnl?account_id=${ACCOUNT_A_ID}&account_scope=exact`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(5000);
  });

  it('filters by account_id with recursive scope (includes descendants)', async () => {
    await insertAccount(ACCOUNT_A_ID);
    await insertAccount(ACCOUNT_B_ID, { parent_account_id: ACCOUNT_A_ID });
    await db('transactions').insert([
      tx({ account_id: ACCOUNT_A_ID, amount: 5000 }),
      tx({ account_id: ACCOUNT_B_ID, amount: 3000 }),
    ]);

    const res = await request(app)
      .get(`/api/reports/pnl?account_id=${ACCOUNT_A_ID}&account_scope=recursive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Both transactions are in the same category+currency bucket, so they sum to 8000
    expect(res.body.income).toHaveLength(1);
    expect(res.body.income[0].amount).toBe(8000);
  });

  it('returns from, to, and filters fields in response', async () => {
    const res = await request(app)
      .get('/api/reports/pnl?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2026-01-01');
    expect(res.body.to).toBe('2026-12-31');
    expect(res.body.filters.property_id).toBeNull();
    expect(res.body.filters.account_id).toBeNull();
    expect(res.body.filters.account_scope).toBeNull();
  });
});
