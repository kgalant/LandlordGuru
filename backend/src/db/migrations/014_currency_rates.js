exports.up = async (knex) => {
  await knex.schema.createTable('currency_rates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.varchar('from_currency', 3).notNullable();
    table.varchar('to_currency', 3).notNullable();
    table.date('effective_date').notNullable();
    table.decimal('rate', 18, 6).notNullable();
    table.varchar('source', 10).notNullable().defaultTo('manual');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // One rate per pair per date per workspace
  await knex.schema.table('currency_rates', (table) => {
    table.unique(['workspace_id', 'from_currency', 'to_currency', 'effective_date']);
  });

  // Optimise the rate-lookup query: most recent rate where effective_date <= transaction date
  await knex.raw(`
    CREATE INDEX currency_rates_lookup_idx
    ON currency_rates (workspace_id, from_currency, to_currency, effective_date DESC)
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS currency_rates_lookup_idx');
  await knex.schema.dropTableIfExists('currency_rates');
};
