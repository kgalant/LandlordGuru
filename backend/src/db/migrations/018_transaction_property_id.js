exports.up = knex =>
  knex.schema.table('transactions', t => {
    t.uuid('property_id').references('id').inTable('properties').onDelete('SET NULL').nullable();
    t.index('property_id');
  });

exports.down = knex =>
  knex.schema.table('transactions', t => {
    t.dropIndex(['property_id']);
    t.dropColumn('property_id');
  });
