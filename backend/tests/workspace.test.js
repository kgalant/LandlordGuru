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
