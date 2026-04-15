#!/usr/bin/env node

require('dotenv').config();
const readline = require('readline');
const db = require('../src/db/knex');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const roles = {
  1: 'owner',
  2: 'editor',
  3: 'viewer',
  4: 'member',
};

(async () => {
  try {
    let workspaceId = process.argv[2];
    let email = process.argv[3];
    let role = process.argv[4];

    // Prompt for workspace ID if not provided
    if (!workspaceId) {
      workspaceId = await question('Workspace ID: ');
      if (!workspaceId.trim()) {
        console.error('Error: Workspace ID is required');
        process.exit(1);
      }
    }

    // Prompt for email if not provided
    if (!email) {
      email = await question('User email: ');
      if (!email.trim()) {
        console.error('Error: Email is required');
        process.exit(1);
      }
    }

    // Prompt for role if not provided
    if (!role) {
      console.log('\nSelect role:');
      console.log('  1) owner');
      console.log('  2) editor');
      console.log('  3) viewer');
      console.log('  4) member');
      const roleChoice = await question('\nRole (1-4): ');
      role = roles[roleChoice];
      if (!role) {
        console.error('Error: Invalid role choice');
        process.exit(1);
      }
    }

    // Validate inputs
    workspaceId = workspaceId.trim();
    email = email.trim().toLowerCase();

    // Confirm before executing
    console.log('\n--- Confirmation ---');
    console.log(`Workspace ID: ${workspaceId}`);
    console.log(`Email:        ${email}`);
    console.log(`Role:         ${role}`);
    const confirm = await question('\nProceed? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Find user by email, or create if doesn't exist
    let user = await db('users').where('email', email).first();
    if (!user) {
      console.log(`\nUser with email "${email}" not found. Creating new user...`);
      const name = await question('User name: ');
      if (!name.trim()) {
        console.error('Error: User name is required');
        process.exit(1);
      }

      const [created] = await db('users')
        .insert({
          email: email,
          name: name.trim(),
          created_at: new Date(),
          last_modified_at: new Date(),
          last_modified_by: null,
        })
        .returning('*');
      user = created;
      console.log(`✓ User created with ID: ${user.id}`);
    }

    // Check if workspace exists
    const workspace = await db('workspaces').where('id', workspaceId).first();
    if (!workspace) {
      console.error(`\nError: Workspace with ID "${workspaceId}" not found`);
      process.exit(1);
    }

    // Check if user is already in workspace
    const existing = await db('workspace_users')
      .where({ workspace_id: workspaceId, user_id: user.id })
      .first();

    if (existing) {
      console.error(`\nError: User is already assigned to this workspace with role "${existing.role}"`);
      process.exit(1);
    }

    // Create the mapping
    await db('workspace_users').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: role,
      joined_at: new Date(),
      last_modified_at: new Date(),
      created_by: null,
      last_modified_by: null,
    });

    // Update user's primary workspace if not set
    if (!user.primary_workspace_id) {
      await db('users')
        .where('id', user.id)
        .update({
          primary_workspace_id: workspaceId,
          last_modified_at: new Date(),
        });
      console.log(`\n✓ User assigned to workspace with role "${role}" and set as primary workspace`);
    } else {
      console.log(`\n✓ User assigned to workspace with role "${role}"`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
