exports.up = async (knex) => {
  await knex.schema.createTable('transactions', (table) => {
    table.varchar('id', 50).primary();
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.date('date').notNullable();
    table.varchar('property_id', 50).references('id').inTable('properties').onDelete('SET NULL');
    table.varchar('type', 20).notNullable();
    table.varchar('category', 50).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.varchar('currency', 3).notNullable();
    table.text('description');
    table.text('raw_description');
    table.varchar('source', 50);
    table.varchar('import_batch', 50);
    table.text('notes');
    table.boolean('reconciled').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('workspace_id');
    table.index(['workspace_id', 'date']);
    table.index(['workspace_id', 'property_id']);
    table.index('import_batch');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('transactions');
};
