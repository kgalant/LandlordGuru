exports.up = async (knex) => {
  await knex.schema.createTable('rules', (table) => {
    table.increments('id').primary();
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('bank_profile', 100);
    table.varchar('keyword', 255).notNullable();
    table.varchar('category', 50).notNullable();
    table.varchar('property_id', 50);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rules');
};
