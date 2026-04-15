#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/knex');

const workspaceName = process.argv[2];

if (!workspaceName) {
  console.error('Usage: node scripts/create-workspace.js <workspace-name>');
  process.exit(1);
}

(async () => {
  try {
    const [workspace] = await db('workspaces')
      .insert({
        name: workspaceName,
        created_at: new Date(),
        last_modified_at: new Date(),
      })
      .returning('*');

    console.log(workspace.id);
    process.exit(0);
  } catch (err) {
    console.error('Error creating workspace:', err.message);
    process.exit(1);
  }
})();
