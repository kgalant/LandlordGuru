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
  // Clean up in dependency order so FK constraints don't complain
  await db('account_properties').del();
  await db('accounts').where('workspace_id', WORKSPACE_ID).del();
});

afterAll(async () => {
  await db.destroy();
});

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------
describe('Accounts schema', () => {
  it('has required columns with correct types and defaults', async () => {
    const account = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Account',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    expect(account.id).toBeDefined();
    expect(account.workspace_id).toBe(WORKSPACE_ID);
    expect(account.name).toBe('Test Account');
    expect(account.parent_account_id).toBeNull();
    expect(account.is_active).toBe(true); // default
    expect(account.is_default).toBe(false);
    expect(account.created_at).toBeDefined();
    expect(account.created_by).toBeNull();
    expect(account.last_modified_at).toBeDefined();
    expect(account.last_modified_by).toBeNull();

    // Cleanup
    await db('accounts').where('id', account.id).del();
  });

  it('enforces constraint: default account cannot have a parent', async () => {
    const parent = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Parent Account',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    // Try to insert a default account with a parent (should fail)
    await expect(
      db('accounts').insert({
        workspace_id: WORKSPACE_ID,
        name: 'Invalid Default',
        is_default: true,
        parent_account_id: parent.id,
      })
    ).rejects.toThrow(); // PostgreSQL check constraint violation

    // Cleanup
    await db('accounts').where('id', parent.id).del();
  });

  it('allows non-default account to have a parent', async () => {
    const parent = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Parent Account',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    const child = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Child Account',
      is_default: false,
      parent_account_id: parent.id,
    }).returning('*').then(rows => rows[0]);

    expect(child.parent_account_id).toBe(parent.id);

    // Cleanup
    await db('account_properties').del();
    await db('accounts').where('workspace_id', WORKSPACE_ID).del();
  });

  it('supports account hierarchy (self-referential FK)', async () => {
    const level1 = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Level 1',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    const level2 = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Level 2',
      is_default: false,
      parent_account_id: level1.id,
    }).returning('*').then(rows => rows[0]);

    const level3 = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Level 3',
      is_default: false,
      parent_account_id: level2.id,
    }).returning('*').then(rows => rows[0]);

    expect(level3.parent_account_id).toBe(level2.id);

    // Verify the hierarchy
    const hierarchy = await db('accounts')
      .where('workspace_id', WORKSPACE_ID)
      .orderBy('name');

    expect(hierarchy.length).toBe(3);
    expect(hierarchy[1].parent_account_id).toBe(hierarchy[0].id);
    expect(hierarchy[2].parent_account_id).toBe(hierarchy[1].id);

    // Cleanup
    await db('accounts').where('workspace_id', WORKSPACE_ID).del();
  });

  it('supports is_active field for archiving', async () => {
    const active = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Active Account',
      is_active: true,
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    const archived = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Archived Account',
      is_active: false,
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    expect(active.is_active).toBe(true);
    expect(archived.is_active).toBe(false);

    // Cleanup
    await db('accounts').where('workspace_id', WORKSPACE_ID).del();
  });

  it('enforces unique index on default account per workspace', async () => {
    // The first account should have been created when workspace was set up
    // Try to create a second default account (should fail)
    const existing = await db('accounts')
      .where('workspace_id', WORKSPACE_ID)
      .first();

    if (existing && existing.is_default) {
      // There's already a default, so trying to create another should fail
      await expect(
        db('accounts').insert({
          workspace_id: WORKSPACE_ID,
          name: 'Another Default',
          is_default: true,
        })
      ).rejects.toThrow(); // Unique index violation
    } else {
      // If no default exists, create one
      const account1 = await db('accounts').insert({
        workspace_id: WORKSPACE_ID,
        name: 'Default 1',
        is_default: true,
      }).returning('*').then(rows => rows[0]);

      // Try to create a second default (should fail)
      await expect(
        db('accounts').insert({
          workspace_id: WORKSPACE_ID,
          name: 'Default 2',
          is_default: true,
        })
      ).rejects.toThrow(); // Unique index violation

      await db('accounts').where('id', account1.id).del();
    }
  });

  it('allows updating is_active to archive an account', async () => {
    const account = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Account',
      is_active: true,
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    // Archive it
    await db('accounts').where('id', account.id).update({ is_active: false });

    const archived = await db('accounts').where('id', account.id).first();
    expect(archived.is_active).toBe(false);

    // Cleanup
    await db('accounts').where('id', account.id).del();
  });
});

// ---------------------------------------------------------------------------
// Integration tests with properties
// ---------------------------------------------------------------------------
describe('Accounts with properties', () => {
  it('linking account to property via account_properties', async () => {
    const account = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Account',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    const property = await db('properties').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Property',
      address: '123 Main St',
      country: 'DK',
      currency: 'DKK',
      model: 'longterm',
    }).returning('*').then(rows => rows[0]);

    const link = await db('account_properties').insert({
      account_id: account.id,
      property_id: property.id,
    }).returning('*').then(rows => rows[0]);

    expect(link.account_id).toBe(account.id);
    expect(link.property_id).toBe(property.id);

    // Cleanup
    await db('account_properties').where({ account_id: account.id, property_id: property.id }).del();
    await db('accounts').where('id', account.id).del();
    await db('properties').where('id', property.id).del();
  });

  it('prevents duplicate account_property links via composite PK', async () => {
    const account = await db('accounts').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Account',
      is_default: false,
    }).returning('*').then(rows => rows[0]);

    const property = await db('properties').insert({
      workspace_id: WORKSPACE_ID,
      name: 'Test Property',
      address: '123 Main St',
      country: 'DK',
      currency: 'DKK',
      model: 'longterm',
    }).returning('*').then(rows => rows[0]);

    await db('account_properties').insert({
      account_id: account.id,
      property_id: property.id,
    });

    // Try to insert the same link again (should fail due to composite PK)
    await expect(
      db('account_properties').insert({
        account_id: account.id,
        property_id: property.id,
      })
    ).rejects.toThrow(); // Primary key violation

    // Cleanup
    await db('account_properties').where({ account_id: account.id, property_id: property.id }).del();
    await db('accounts').where('id', account.id).del();
    await db('properties').where('id', property.id).del();
  });
});
