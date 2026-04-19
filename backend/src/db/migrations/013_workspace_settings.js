exports.up = async (knex) => {
  await knex.schema.table('workspaces', (table) => {
    table.varchar('reporting_currency', 3).notNullable().defaultTo('USD');
    table.integer('max_account_depth').notNullable().defaultTo(5);
  });
};

exports.down = async (knex) => {
  await knex.schema.table('workspaces', (table) => {
    table.dropColumn('reporting_currency');
    table.dropColumn('max_account_depth');
  });
};
