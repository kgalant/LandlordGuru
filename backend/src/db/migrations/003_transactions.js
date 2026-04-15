exports.up = async (knex) => {
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.date('date').notNullable();
    table.uuid('property_id').references('id').inTable('properties').onDelete('SET NULL');
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
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_modified_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('last_modified_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
    table.index(['workspace_id', 'date']);
    table.index(['workspace_id', 'property_id']);
    table.index('import_batch');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('transactions');
};
