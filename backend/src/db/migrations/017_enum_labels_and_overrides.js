const BUILTIN_LABELS = {
  rent:               'Rent',
  heating_aconto:     'Heating & water (a/c)',
  heating_settlement: 'Heating settlement',
  maintenance_repair: 'Maintenance & repair',
  property_tax:       'Property tax',
  insurance:          'Insurance',
  utilities:          'Utilities',
  management_fee:     'Management fee',
  advertising:        'Advertising',
  professional_fees:  'Professional fees',
  bank_charges:       'Bank charges',
  other_expense:      'Other expense',
  deposit_received:   'Deposit received',
  deposit_returned:   'Deposit returned',
  inter_account:      'Inter-account transfer',
};

exports.up = async (knex) => {
  // 1. Add label column to workspace_enum_values
  await knex.schema.alterTable('workspace_enum_values', (table) => {
    table.varchar('label', 255).nullable();
  });

  // 2. Seed labels for built-in categories
  for (const [value, label] of Object.entries(BUILTIN_LABELS)) {
    await knex('workspace_enum_values')
      .where({ enum_type: 'transaction_category', value, is_builtin: true })
      .update({ label });
  }

  // 3. Make label not-nullable now that built-ins are seeded
  await knex.schema.alterTable('workspace_enum_values', (table) => {
    table.varchar('label', 255).notNullable().alter();
  });

  // 4. Create workspace_enum_overrides for per-workspace customisation of built-in rows
  await knex.schema.createTable('workspace_enum_overrides', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.uuid('enum_value_id').notNullable().references('id').inTable('workspace_enum_values').onDelete('CASCADE');
    // null means "use the built-in default label"
    table.varchar('label', 255).nullable();
    // null means "inherit built-in default (true)"
    table.boolean('is_active').nullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.unique(['workspace_id', 'enum_value_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('workspace_enum_overrides');
  await knex.schema.alterTable('workspace_enum_values', (table) => {
    table.dropColumn('label');
  });
};
