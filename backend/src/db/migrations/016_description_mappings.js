exports.up = async (knex) => {
  await knex.schema.createTable('description_mappings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    // NULL = global (workspace-wide) mapping; non-null = user-specific
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    // Empty string means "any bank profile"
    table.varchar('bank_profile', 100).notNullable().defaultTo('');
    table.varchar('keyword', 255).notNullable();
    table.varchar('category', 50).notNullable();
    table.uuid('property_id').nullable().references('id').inTable('properties').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
  });

  // Unique: one user-specific mapping per (workspace, user, bank_profile, keyword)
  await knex.raw(`
    CREATE UNIQUE INDEX description_mappings_user_unique
    ON description_mappings (workspace_id, user_id, bank_profile, keyword)
    WHERE user_id IS NOT NULL
  `);

  // Unique: one global mapping per (workspace, bank_profile, keyword)
  await knex.raw(`
    CREATE UNIQUE INDEX description_mappings_global_unique
    ON description_mappings (workspace_id, bank_profile, keyword)
    WHERE user_id IS NULL
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS description_mappings_global_unique');
  await knex.raw('DROP INDEX IF EXISTS description_mappings_user_unique');
  await knex.schema.dropTableIfExists('description_mappings');
};
