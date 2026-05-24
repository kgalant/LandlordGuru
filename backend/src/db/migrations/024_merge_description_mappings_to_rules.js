// Merge description_mappings into rules.
// Description mappings and auto-categorisation rules do the same job (keyword → category).
// Going forward, "remember this mapping" during import saves a rule instead.
// This migration copies existing description_mappings into rules, skipping any
// where a rule with the same workspace + keyword already exists.

exports.up = async (knex) => {
  const mappings = await knex('description_mappings').select('*');
  if (!mappings.length) return;

  // Current max sort_order per workspace so migrated rules sort after existing ones
  const maxOrders = await knex('rules')
    .select('workspace_id')
    .max('sort_order as max_order')
    .groupBy('workspace_id');
  const maxOrderMap = {};
  maxOrders.forEach(r => { maxOrderMap[r.workspace_id] = parseInt(r.max_order) || 0; });

  for (const m of mappings) {
    // Skip if a rule with the same workspace + keyword already exists (case-insensitive)
    const existing = await knex('rules')
      .where('workspace_id', m.workspace_id)
      .whereRaw('LOWER(keyword) = LOWER(?)', [m.keyword])
      .first();
    if (existing) continue;

    const sortOrder = (maxOrderMap[m.workspace_id] || 0) + 1;
    maxOrderMap[m.workspace_id] = sortOrder;

    await knex('rules').insert({
      workspace_id: m.workspace_id,
      keyword:      m.keyword,
      category:     m.category,
      // description_mappings uses '' for "any bank"; rules use null
      bank_profile: m.bank_profile || null,
      property_id:  m.property_id  || null,
      sort_order:   sortOrder,
      created_by:   m.created_by   || null,
    });
  }
};

exports.down = async (knex) => {
  // Not reversible — we cannot distinguish migrated rules from manually created ones
};
