exports.up = async (knex) => {
  await knex.schema.alterTable('transactions', (table) => {
    table.date('original_date').nullable();
    table.decimal('original_amount', 15, 4).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('transactions', (table) => {
    table.dropColumn('original_date');
    table.dropColumn('original_amount');
  });
};
