/**
 * Migration 012: Create activity_log table
 * Captures all backend operations and frontend telemetry for debugging and statistics
 */

exports.up = async (knex) => {
  await knex.schema.createTable('activity_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE').index();
    table.uuid('user_id').nullable().references('users.id').onDelete('SET NULL').index();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.string('level', 10).notNullable().index().comment('error, info, or debug');
    table.string('source', 20).notNullable().comment('backend or frontend');
    table.string('action', 100).notNullable().index().comment('dot-notation event name');
    table.text('description').nullable().comment('human-readable summary');
    table.jsonb('parameters').notNullable().defaultTo('{}').comment('event-specific metadata');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Composite index for efficient querying by workspace + timestamp (most common query)
  await knex.raw('CREATE INDEX idx_activity_log_workspace_timestamp ON activity_log (workspace_id, "timestamp" DESC)');
  await knex.raw('CREATE INDEX idx_activity_log_user_timestamp ON activity_log (user_id, "timestamp" DESC)');
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('activity_log');
};
