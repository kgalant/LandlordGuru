/**
 * Migration 011: Add logging configuration to workspace_users table
 * Adds log_level and log_level_expires_at columns for per-user log verbosity control
 */

exports.up = async (knex) => {
  await knex.schema.table('workspace_users', (table) => {
    table.string('log_level', 10).nullable().comment('error, info, or debug; null = use workspace setting');
    table.timestamp('log_level_expires_at').nullable().comment('When the user override expires; null = permanent');
  });
};

exports.down = async (knex) => {
  await knex.schema.table('workspace_users', (table) => {
    table.dropColumn('log_level');
    table.dropColumn('log_level_expires_at');
  });
};
