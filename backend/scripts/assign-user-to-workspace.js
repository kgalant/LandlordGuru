#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/knex');

const workspaceId = process.argv[2];
const email = process.argv[3];
const role = process.argv[4] || 'member';

if (!workspaceId || !email) {
  console.error('Usage: node scripts/assign-user-to-workspace.js <workspace-id> <email> [role]');
  console.error('  role defaults to "member", can also be "owner" or "admin"');
  process.exit(1);
}

(async () => {
  try {
    // Find user by email
    const user = await db('users').where('email', email).first();
    if (!user) {
      console.error(`Error: User with email "${email}" not found`);
      process.exit(1);
    }

    // Check if workspace exists
    const workspace = await db('workspaces').where('id', workspaceId).first();
    if (!workspace) {
      console.error(`Error: Workspace with ID "${workspaceId}" not found`);
      process.exit(1);
    }

    // Check if user is already in workspace
    const existing = await db('workspace_users')
      .where({ workspace_id: workspaceId, user_id: user.id })
      .first();

    if (existing) {
      console.error(`Error: User is already assigned to this workspace with role "${existing.role}"`);
      process.exit(1);
    }

    // Create the mapping
    await db('workspace_users').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: role,
      joined_at: new Date(),
      created_at: new Date(),
      last_modified_at: new Date(),
    });

    // Update user's primary workspace if not set
    if (!user.primary_workspace_id) {
      await db('users')
        .where('id', user.id)
        .update({
          primary_workspace_id: workspaceId,
          last_modified_at: new Date(),
        });
      console.log(`✓ User assigned to workspace with role "${role}" and set as primary workspace`);
    } else {
      console.log(`✓ User assigned to workspace with role "${role}"`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error assigning user:', err.message);
    process.exit(1);
  }
})();
