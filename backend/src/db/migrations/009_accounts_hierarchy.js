exports.up = async (knex) => {
  // Add parent_account_id for hierarchy support
  await knex.schema.alterTable('accounts', (table) => {
    table.uuid('parent_account_id')
      .nullable()
      .references('id')
      .inTable('accounts')
      .onDelete('SET NULL');
  });

  // Rename active to isActive for clarity
  await knex.raw(`
    ALTER TABLE accounts
    RENAME COLUMN active TO is_active
  `);

  // Add constraint: parent_account_id must be NULL when is_default = true
  await knex.raw(`
    ALTER TABLE accounts
    ADD CONSTRAINT accounts_default_cannot_have_parent
    CHECK (NOT (is_default = true AND parent_account_id IS NOT NULL))
  `);

  // Add index on parent_account_id for hierarchy queries
  await knex.schema.alterTable('accounts', (table) => {
    table.index('parent_account_id');
  });
};

exports.down = async (knex) => {
  // Remove index
  await knex.schema.alterTable('accounts', (table) => {
    table.dropIndex('parent_account_id');
  });

  // Drop constraint
  await knex.raw(`
    ALTER TABLE accounts
    DROP CONSTRAINT IF EXISTS accounts_default_cannot_have_parent
  `);

  // Rename back
  await knex.raw(`
    ALTER TABLE accounts
    RENAME COLUMN is_active TO active
  `);

  // Drop parent_account_id
  await knex.schema.alterTable('accounts', (table) => {
    table.dropColumn('parent_account_id');
  });
};
