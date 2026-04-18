/**
 * Migration 010: Add logging configuration to workspaces table
 * Adds log_level and log_level_expires_at columns for per-workspace log verbosity control
 */

exports.up = async (knex) => {
  await knex.schema.table('workspaces', (table) => {
    table.string('log_level', 10).nullable().comment('error, info, or debug; null = use global default');
    table.timestamp('log_level_expires_at').nullable().comment('When the override expires; null = permanent');
  });
};

exports.down = async (knex) => {
  await knex.schema.table('workspaces', (table) => {
    table.dropColumn('log_level');
    table.dropColumn('log_level_expires_at');
  });
};
