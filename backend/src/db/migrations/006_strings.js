exports.up = async (knex) => {
  await knex.schema.createTable('strings', (table) => {
    table.increments('id').primary();
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('key', 255).notNullable();
    table.varchar('lang', 10).notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.text('value').notNullable();
    table.unique(['workspace_id', 'key', 'lang', 'user_id']);
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('strings');
};
