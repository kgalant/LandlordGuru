exports.up = async (knex) => {
  await knex.schema.createTable('rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('bank_profile', 100);
    table.varchar('keyword', 255).notNullable();
    table.varchar('category', 50).notNullable();
    table.uuid('property_id');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_modified_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('last_modified_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rules');
};
