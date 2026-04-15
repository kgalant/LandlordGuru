exports.up = async (knex) => {
  await knex.schema.createTable('strings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('key', 255).notNullable();
    table.varchar('lang', 10).notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.text('value').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at');
    table.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.unique(['workspace_id', 'key', 'lang', 'user_id']);
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('strings');
};
