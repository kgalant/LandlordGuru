require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/knex');
const jwt = require('jsonwebtoken');
const { WORKSPACE_ID, USER_ID, setupAppWithDb } = require('./helpers');

beforeAll(() => {
  setupAppWithDb(app, db);
});

describe('Workspace Settings API', () => {
  let testWorkspaceId;
  let testUserId;
  let ownerToken;
  let memberToken;

  beforeEach(async () => {
    // Clean up only non-seed test data so globalSetup's seed workspace/user survive
    await db('workspace_users').whereNot('workspace_id', WORKSPACE_ID).del();
    await db('workspaces').whereNot('id', WORKSPACE_ID).del();
    await db('users').whereNot('id', USER_ID).del();

    // Create test user
    const [user] = await db('users')
      .insert({
        email: 'owner@test.com',
        name: 'Owner User',
        google_id: 'google_owner',
      })
      .returning('*');
    testUserId = user.id;

    // Create test workspace
    const [workspace] = await db('workspaces')
      .insert({
        name: 'Test Workspace',
        reporting_currency: 'USD',
        max_account_depth: 5,
      })
      .returning('*');
    testWorkspaceId = workspace.id;

    // Add user as owner
    await db('workspace_users').insert({
      workspace_id: testWorkspaceId,
      user_id: testUserId,
      role: 'owner',
    });

    // Create owner token
    ownerToken = jwt.sign(
      {
        user_id: testUserId,
        email: 'owner@test.com',
        name: 'Owner User',
        role: 'owner',
        workspace_id: testWorkspaceId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create another user as member
    const [memberUser] = await db('users')
      .insert({
        email: 'member@test.com',
        name: 'Member User',
        google_id: 'google_member',
      })
      .returning('*');

    await db('workspace_users').insert({
      workspace_id: testWorkspaceId,
      user_id: memberUser.id,
      role: 'member',
    });

    memberToken = jwt.sign(
      {
        user_id: memberUser.id,
        email: 'member@test.com',
        name: 'Member User',
        role: 'member',
        workspace_id: testWorkspaceId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await db('workspace_users').whereNot('workspace_id', WORKSPACE_ID).del();
    await db('workspaces').whereNot('id', WORKSPACE_ID).del();
    await db('users').whereNot('id', USER_ID).del();
  });

  describe('GET /api/workspace/settings', () => {
    it('should return workspace settings for authenticated user', async () => {
      const res = await request(app)
        .get('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', testWorkspaceId);
      expect(res.body).toHaveProperty('reporting_currency', 'USD');
      expect(res.body).toHaveProperty('max_account_depth', 5);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/workspace/settings');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return settings for member user', async () => {
      const res = await request(app)
        .get('/api/workspace/settings')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reporting_currency', 'USD');
    });
  });

  describe('Transaction Categories API', () => {
    describe('GET /api/workspace/enums/transaction-categories', () => {
      it('returns built-in categories grouped by type_bucket', async () => {
        const res = await request(app)
          .get('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('income');
        expect(res.body).toHaveProperty('expense');
        expect(res.body.income.some((c) => c.value === 'rent' && c.is_builtin)).toBe(true);
        expect(res.body.expense.some((c) => c.value === 'insurance' && c.is_builtin)).toBe(true);
      });

      it('includes custom categories alongside built-ins', async () => {
        await db('workspace_enum_values').insert({
          workspace_id: testWorkspaceId,
          enum_type:   'transaction_category',
          type_bucket: 'income',
          value:       'custom_income',
          is_builtin:  false,
          is_active:   true,
        });

        const res = await request(app)
          .get('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        const custom = res.body.income.find((c) => c.value === 'custom_income');
        expect(custom).toBeDefined();
        expect(custom.is_builtin).toBe(false);
      });

      it('is accessible to member users', async () => {
        const res = await request(app)
          .get('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(200);
      });

      it('returns 401 without auth', async () => {
        const res = await request(app)
          .get('/api/workspace/enums/transaction-categories');

        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/workspace/enums/transaction-categories', () => {
      it('owner can create a custom category', async () => {
        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ type_bucket: 'income', value: 'parking_fee' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('value', 'parking_fee');
        expect(res.body).toHaveProperty('is_builtin', false);
      });

      it('returns 403 for non-owner', async () => {
        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ type_bucket: 'income', value: 'parking_fee' });

        expect(res.status).toBe(403);
      });

      it('returns 400 when type_bucket is missing', async () => {
        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ value: 'parking_fee' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/type_bucket/);
      });

      it('returns 400 when value is missing', async () => {
        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ type_bucket: 'income' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/value/);
      });

      it('returns 409 for duplicate value within same bucket', async () => {
        await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ type_bucket: 'income', value: 'parking_fee' });

        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ type_bucket: 'income', value: 'parking_fee' });

        expect(res.status).toBe(409);
      });

      it('returns 409 when value matches a built-in in the same bucket', async () => {
        const res = await request(app)
          .post('/api/workspace/enums/transaction-categories')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ type_bucket: 'income', value: 'rent' });

        expect(res.status).toBe(409);
      });
    });

    describe('DELETE /api/workspace/enums/transaction-categories/:id', () => {
      it('owner can delete a custom category', async () => {
        const [created] = await db('workspace_enum_values')
          .insert({
            workspace_id: testWorkspaceId,
            enum_type:   'transaction_category',
            type_bucket: 'income',
            value:       'to_be_deleted',
            is_builtin:  false,
            is_active:   true,
          })
          .returning('id');

        const res = await request(app)
          .delete(`/api/workspace/enums/transaction-categories/${created.id}`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(204);

        const row = await db('workspace_enum_values').where('id', created.id).first();
        expect(row).toBeUndefined();
      });

      it('returns 403 for non-owner', async () => {
        const [created] = await db('workspace_enum_values')
          .insert({
            workspace_id: testWorkspaceId,
            enum_type:   'transaction_category',
            type_bucket: 'income',
            value:       'member_cannot_delete',
            is_builtin:  false,
            is_active:   true,
          })
          .returning('id');

        const res = await request(app)
          .delete(`/api/workspace/enums/transaction-categories/${created.id}`)
          .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(403);
      });

      it('returns 404 for non-existent id', async () => {
        const res = await request(app)
          .delete('/api/workspace/enums/transaction-categories/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(404);
      });

      it('returns 403 when trying to delete a built-in category', async () => {
        const builtin = await db('workspace_enum_values')
          .where({ enum_type: 'transaction_category', value: 'rent', is_builtin: true })
          .first();

        const res = await request(app)
          .delete(`/api/workspace/enums/transaction-categories/${builtin.id}`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/built-in/i);
      });

      it('returns 409 when category is in use by a transaction', async () => {
        // Insert a custom category
        const [cat] = await db('workspace_enum_values')
          .insert({
            workspace_id: testWorkspaceId,
            enum_type:   'transaction_category',
            type_bucket: 'income',
            value:       'in_use_cat',
            is_builtin:  false,
            is_active:   true,
          })
          .returning('id');

        // Create an account and a transaction that uses the category
        const [account] = await db('accounts')
          .insert({ workspace_id: testWorkspaceId, name: 'Test Account' })
          .returning('id');

        await db('transactions').insert({
          workspace_id: testWorkspaceId,
          account_id:   account.id,
          date:         '2026-01-01',
          type:         'income',
          category:     'in_use_cat',
          amount:       100,
          currency:     'USD',
        });

        const res = await request(app)
          .delete(`/api/workspace/enums/transaction-categories/${cat.id}`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('count', 1);
      });
    });
  });

  describe('PATCH /api/workspace/settings', () => {
    it('should allow owner to update reporting_currency', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reporting_currency: 'DKK' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reporting_currency', 'DKK');

      // Verify in database
      const updated = await db('workspaces')
        .where({ id: testWorkspaceId })
        .select('reporting_currency')
        .first();
      expect(updated.reporting_currency).toBe('DKK');
    });

    it('should allow owner to update max_account_depth', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ max_account_depth: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('max_account_depth', 10);
    });

    it('should allow owner to update both settings at once', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          reporting_currency: 'EUR',
          max_account_depth: 8,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reporting_currency', 'EUR');
      expect(res.body).toHaveProperty('max_account_depth', 8);
    });

    it('should deny non-owner user from updating settings', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ reporting_currency: 'GBP' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate reporting_currency format', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reporting_currency: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate max_account_depth is positive', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ max_account_depth: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject with no valid settings to update', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'No valid settings to update');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .send({ reporting_currency: 'EUR' });

      expect(res.status).toBe(401);
    });

    it('should normalize currency code to uppercase', async () => {
      const res = await request(app)
        .patch('/api/workspace/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reporting_currency: 'gbp' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reporting_currency', 'GBP');
    });
  });
});
