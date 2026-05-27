// Migration 025 — Rules rework
// Replaces bank_profile / property_id columns with a rule_properties junction table.
// Rules now scope to one-or-many properties (or none = global).

exports.up = async (knex) => {
  // 1. Create the junction table
  await knex.schema.createTable('rule_properties', (t) => {
    t.uuid('rule_id')
      .notNullable()
      .references('id')
      .inTable('rules')
      .onDelete('CASCADE');
    t.uuid('property_id')
      .notNullable()
      .references('id')
      .inTable('properties')
      .onDelete('CASCADE');
    t.primary(['rule_id', 'property_id']);
  });

  // 2. Migrate existing single property_id values into the junction table
  await knex.raw(`
    INSERT INTO rule_properties (rule_id, property_id)
    SELECT id, property_id
    FROM rules
    WHERE property_id IS NOT NULL
  `);

  // 3. Drop the old columns
  await knex.schema.alterTable('rules', (t) => {
    t.dropColumn('bank_profile');
    t.dropColumn('property_id');
  });
};

exports.down = async (knex) => {
  // Restore the old columns (nullable, no data recovery)
  await knex.schema.alterTable('rules', (t) => {
    t.string('bank_profile').nullable();
    t.uuid('property_id')
      .nullable()
      .references('id')
      .inTable('properties')
      .onDelete('SET NULL');
  });

  await knex.schema.dropTableIfExists('rule_properties');
};
