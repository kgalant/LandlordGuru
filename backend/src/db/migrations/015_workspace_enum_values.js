const BUILTIN_TRANSACTION_CATEGORIES = [
  { type_bucket: 'income',   value: 'rent' },
  { type_bucket: 'income',   value: 'heating_aconto' },
  { type_bucket: 'income',   value: 'heating_settlement' },
  { type_bucket: 'expense',  value: 'maintenance_repair' },
  { type_bucket: 'expense',  value: 'property_tax' },
  { type_bucket: 'expense',  value: 'insurance' },
  { type_bucket: 'expense',  value: 'utilities' },
  { type_bucket: 'expense',  value: 'management_fee' },
  { type_bucket: 'expense',  value: 'advertising' },
  { type_bucket: 'expense',  value: 'professional_fees' },
  { type_bucket: 'expense',  value: 'bank_charges' },
  { type_bucket: 'expense',  value: 'other_expense' },
  { type_bucket: 'deposit',  value: 'deposit_received' },
  { type_bucket: 'deposit',  value: 'deposit_returned' },
  { type_bucket: 'transfer', value: 'inter_account' },
];

exports.up = async (knex) => {
  await knex.schema.createTable('workspace_enum_values', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // NULL workspace_id = built-in global value (applies to all workspaces)
    table.uuid('workspace_id').nullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('enum_type', 64).notNullable();
    table.varchar('type_bucket', 64).nullable();
    table.varchar('value', 128).notNullable();
    table.boolean('is_builtin').notNullable().defaultTo(false);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
  });

  // Custom values must be unique per workspace + enum type + bucket + value
  await knex.raw(`
    CREATE UNIQUE INDEX workspace_enum_values_custom_unique
    ON workspace_enum_values (workspace_id, enum_type, type_bucket, value)
    WHERE workspace_id IS NOT NULL
  `);

  // Built-in values must be unique per enum type + bucket + value
  await knex.raw(`
    CREATE UNIQUE INDEX workspace_enum_values_builtin_unique
    ON workspace_enum_values (enum_type, type_bucket, value)
    WHERE is_builtin = true
  `);

  // Fast lookup: all active values for a workspace's enum type
  await knex.raw(`
    CREATE INDEX workspace_enum_values_lookup_idx
    ON workspace_enum_values (enum_type, workspace_id, is_active)
  `);

  await knex('workspace_enum_values').insert(
    BUILTIN_TRANSACTION_CATEGORIES.map((row) => ({
      workspace_id: null,
      enum_type:    'transaction_category',
      type_bucket:  row.type_bucket,
      value:        row.value,
      is_builtin:   true,
      is_active:    true,
    }))
  );
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS workspace_enum_values_lookup_idx');
  await knex.raw('DROP INDEX IF EXISTS workspace_enum_values_builtin_unique');
  await knex.raw('DROP INDEX IF EXISTS workspace_enum_values_custom_unique');
  await knex.schema.dropTableIfExists('workspace_enum_values');
};
