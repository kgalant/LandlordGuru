exports.up = async (knex) => {
  await knex.schema.createTable('properties', (table) => {
    table.varchar('id', 50).primary();
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('name', 255).notNullable();
    table.text('address');
    table.varchar('country', 2);
    table.varchar('currency', 3);
    table.varchar('model', 20);
    table.decimal('rent', 12, 2);
    table.decimal('aconto', 12, 2);
    table.varchar('tenant', 255);
    table.date('lease_start');
    table.text('notes');
    table.boolean('active').notNullable().defaultTo(true);
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('properties');
};
