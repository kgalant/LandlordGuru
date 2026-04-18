exports.up = async (knex) => {
  // Create accounts table.
  // Each workspace gets one is_default=true account created automatically at workspace creation time.
  // This account is the fallback for transactions not assigned to a more specific account.
  // Enforced: at most one is_default=true per workspace (partial unique index below).
  await knex.schema.createTable('accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('name', 255).notNullable();
    table.text('notes');
    table.boolean('active').notNullable().defaultTo(true);
    table.boolean('is_default').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_modified_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('last_modified_by').references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
  });

  // Enforce at most one default account per workspace
  await knex.raw(`
    CREATE UNIQUE INDEX accounts_one_default_per_workspace
    ON accounts (workspace_id)
    WHERE is_default = true
  `);

  // Join table linking accounts to one or more properties
  await knex.schema.createTable('account_properties', (table) => {
    table.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.uuid('property_id').notNullable().references('id').inTable('properties').onDelete('CASCADE');
    table.primary(['account_id', 'property_id']);
  });

  // Replace property_id with account_id on transactions.
  // Transactions are an accounting event and belong to an account, not directly to a property.
  // To look up transactions for a specific property, join through account_properties.
  await knex.schema.alterTable('transactions', (table) => {
    table.dropIndex(['workspace_id', 'property_id']);
    table.dropColumn('property_id');
    table.uuid('account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
    table.index(['workspace_id', 'account_id']);
  });
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS accounts_one_default_per_workspace');

  await knex.schema.alterTable('transactions', (table) => {
    table.dropIndex(['workspace_id', 'account_id']);
    table.dropColumn('account_id');
    table.uuid('property_id').nullable().references('id').inTable('properties').onDelete('SET NULL');
    table.index(['workspace_id', 'property_id']);
  });

  await knex.schema.dropTableIfExists('account_properties');
  await knex.schema.dropTableIfExists('accounts');
};
