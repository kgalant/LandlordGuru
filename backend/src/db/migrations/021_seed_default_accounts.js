// Data migration: ensure every workspace has a default account, every active property
// has a linked account, and every transaction has a non-null account_id.
//
// Safe to re-run: all steps are guarded by WHERE NOT EXISTS / IS NULL checks.

exports.up = async (knex) => {
  // 1. Create a default account for each workspace that doesn't already have one.
  await knex.raw(`
    INSERT INTO accounts (workspace_id, name, is_default, is_active, created_at, last_modified_at)
    SELECT w.id, 'Default', true, true, NOW(), NOW()
    FROM workspaces w
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.workspace_id = w.id AND a.is_default = true
    )
  `);

  // 2. Create an account for each active property that has no entry in account_properties,
  //    then link them. Done row-by-row to safely capture the new account UUID per property.
  const unlinkedProps = await knex('properties as p')
    .leftJoin('account_properties as ap', 'ap.property_id', 'p.id')
    .whereNull('ap.account_id')
    .select('p.id as property_id', 'p.workspace_id', 'p.name');

  for (const prop of unlinkedProps) {
    const [account] = await knex('accounts')
      .insert({ workspace_id: prop.workspace_id, name: prop.name, is_default: false, is_active: true })
      .returning('id');
    await knex('account_properties').insert({
      account_id: account.id,
      property_id: prop.property_id,
    });
  }

  // 3a. For transactions with NULL account_id but a set property_id, assign to that
  //     property's linked account.
  await knex.raw(`
    UPDATE transactions t
    SET account_id = ap.account_id
    FROM account_properties ap
    WHERE t.account_id IS NULL
      AND t.property_id IS NOT NULL
      AND ap.property_id = t.property_id
  `);

  // 3b. For any remaining transactions with NULL account_id, assign to the workspace
  //     default account.
  await knex.raw(`
    UPDATE transactions t
    SET account_id = a.id
    FROM accounts a
    WHERE t.account_id IS NULL
      AND a.workspace_id = t.workspace_id
      AND a.is_default = true
  `);
};

exports.down = async (knex) => {
  // This migration only seeds data; reversing it would silently delete user-created
  // accounts and unlink transactions, which is destructive. The down migration is
  // intentionally a no-op.
};
