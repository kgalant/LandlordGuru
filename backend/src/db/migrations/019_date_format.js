exports.up = async (knex) => {
  await knex.schema.alterTable('workspaces', (table) => {
    table.varchar('date_format', 10).notNullable().defaultTo('YYYY-MM-DD');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('workspaces', (table) => {
    table.dropColumn('date_format');
  });
};
