exports.up = async (knex) => {
  await knex.schema.createTable('fx_log', (table) => {
    table.increments('id').primary();
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.date('date').notNullable();
    table.varchar('from_currency', 3).notNullable();
    table.varchar('to_currency', 3).notNullable();
    table.decimal('rate', 12, 6).notNullable();
    table.varchar('source', 50);
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('fx_log');
};
