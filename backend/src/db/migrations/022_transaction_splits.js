exports.up = async (knex) => {
  await knex.schema.alterTable('transactions', (table) => {
    table
      .uuid('parent_transaction_id')
      .nullable()
      .references('id')
      .inTable('transactions')
      .onDelete('CASCADE');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('transactions', (table) => {
    table.dropColumn('parent_transaction_id');
  });
};
