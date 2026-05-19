exports.up = async (knex) => {
  await knex.schema.createTable('split_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.jsonb('conditions').notNullable().defaultTo('[]');
    table.jsonb('template').notNullable().defaultTo('[]');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.index('workspace_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('split_rules');
};
