// Runs once before all test suites.
// Loads .env.test, runs migrations, seeds a test workspace and user.

require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

module.exports = async () => {
  // Run all migrations on the test DB
  await knex.migrate.latest({
    directory: require('path').join(__dirname, '../src/db/migrations'),
  });

  // Seed one workspace and one user so FK constraints are satisfied
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const userId      = '00000000-0000-0000-0000-000000000002';

  await knex('workspaces').insert({
    id:   workspaceId,
    name: 'Test Workspace',
  }).onConflict('id').ignore();

  await knex('users').insert({
    id:         userId,
    email:      'test@example.com',
    name:       'Test User',
    google_id:  'test-google-id',
    primary_workspace_id: workspaceId,
  }).onConflict('id').ignore();

  await knex('workspace_users').insert({
    workspace_id: workspaceId,
    user_id:      userId,
    role:         'owner',
  }).onConflict(['workspace_id', 'user_id']).ignore();

  // Expose IDs so test files can import them
  global.__TEST_WORKSPACE_ID__ = workspaceId;
  global.__TEST_USER_ID__       = userId;

  await knex.destroy();
};
