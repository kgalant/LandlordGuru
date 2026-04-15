exports.up = async (knex) => {
  await knex.schema.createTable('fx_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.date('date').notNullable();
    table.varchar('from_currency', 3).notNullable();
    table.varchar('to_currency', 3).notNullable();
    table.decimal('rate', 12, 6).notNullable();
    table.varchar('source', 50);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_modified_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('last_modified_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('fx_log');
};
