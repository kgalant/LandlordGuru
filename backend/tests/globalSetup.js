// Runs once before all test suites.
// Loads .env.test, runs migrations, resets all data, then seeds a clean baseline.

require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

module.exports = async () => {
  // 1. Run all migrations so schema is current
  await knex.migrate.latest({
    directory: require('path').join(__dirname, '../src/db/migrations'),
  });

  // 2. Reset all user data in FK-safe order using DELETE (not TRUNCATE) so that
  //    workspace_enum_values global builtins (workspace_id = NULL) are preserved.
  await knex.raw('DELETE FROM transactions');
  await knex.raw('DELETE FROM account_properties');
  await knex.raw('DELETE FROM split_rules');
  await knex.raw('DELETE FROM rules');
  await knex.raw('DELETE FROM currency_rates');
  await knex.raw('DELETE FROM description_mappings');
  await knex.raw('DELETE FROM strings');
  await knex.raw('DELETE FROM fx_log');
  await knex.raw('DELETE FROM activity_log');
  await knex.raw('DELETE FROM workspace_enum_overrides');
  await knex.raw('DELETE FROM workspace_users');
  await knex.raw('DELETE FROM accounts');
  await knex.raw('DELETE FROM properties');
  await knex.raw('UPDATE users SET primary_workspace_id = NULL');
  await knex.raw('DELETE FROM users');
  await knex.raw('DELETE FROM workspaces');

  // 3. Seed baseline workspace, user, and default account
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const userId      = '00000000-0000-0000-0000-000000000002';
  const accountId   = '00000000-0000-0000-0000-000000000003';

  await knex('workspaces').insert({ id: workspaceId, name: 'Test Workspace' });

  await knex('users').insert({
    id:                   userId,
    email:                'test@example.com',
    name:                 'Test User',
    google_id:            'test-google-id',
    primary_workspace_id: workspaceId,
  });

  await knex('workspace_users').insert({
    workspace_id: workspaceId,
    user_id:      userId,
    role:         'owner',
  });

  // Default account — required so transactions without an explicit account_id
  // fall back cleanly and migration 021 invariants hold between test runs.
  await knex('accounts').insert({
    id:               accountId,
    workspace_id:     workspaceId,
    name:             'Default Account',
    is_default:       true,
    is_active:        true,
    created_by:       userId,
    last_modified_by: userId,
  });

  // Expose IDs for use in test files via helpers.js constants
  global.__TEST_WORKSPACE_ID__ = workspaceId;
  global.__TEST_USER_ID__      = userId;
  global.__TEST_ACCOUNT_ID__   = accountId;

  await knex.destroy();
};
