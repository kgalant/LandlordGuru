exports.up = async (knex) => {
  // Check if primary_workspace_id exists; if not, add it
  const hasColumn = await knex.schema.hasColumn('users', 'primary_workspace_id');
  if (!hasColumn) {
    await knex.schema.table('users', (table) => {
      table.uuid('primary_workspace_id').references('id').inTable('workspaces').onDelete('SET NULL');
    });
  }

  // Add created_by if it doesn't exist
  const hasCreatedBy = await knex.schema.hasColumn('users', 'created_by');
  if (!hasCreatedBy) {
    await knex.schema.table('users', (table) => {
      table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }
};

exports.down = async (knex) => {
  // Remove created_by
  const hasCreatedBy = await knex.schema.hasColumn('users', 'created_by');
  if (hasCreatedBy) {
    await knex.schema.table('users', (table) => {
      table.dropColumn('created_by');
    });
  }

  // Remove primary_workspace_id
  const hasColumn = await knex.schema.hasColumn('users', 'primary_workspace_id');
  if (hasColumn) {
    await knex.schema.table('users', (table) => {
      table.dropColumn('primary_workspace_id');
    });
  }
};
