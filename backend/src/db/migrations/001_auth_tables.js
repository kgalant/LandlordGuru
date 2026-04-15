exports.up = async (knex) => {
  await knex.schema.createTable('workspaces', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('name', 255).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by');
    table.timestamp('updated_at');
    table.uuid('updated_by');
  });

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('email', 255).notNullable().unique();
    table.varchar('name', 255);
    table.varchar('google_id', 255).unique();
    table.varchar('avatar_url', 500);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at');
    table.uuid('updated_by');
  });

  // created_by/updated_by on workspaces now reference users
  await knex.schema.table('workspaces', (table) => {
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // updated_by on users self-references users
  await knex.schema.table('users', (table) => {
    table.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.schema.createTable('workspace_users', (table) => {
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.varchar('role', 50).notNullable().defaultTo('member');
    table.jsonb('permissions');
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at');
    table.uuid('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.primary(['workspace_id', 'user_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('workspace_users');
  await knex.schema.dropTableIfExists('workspaces');
  await knex.schema.dropTableIfExists('users');
};
