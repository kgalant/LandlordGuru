#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const readline = require('readline');
const { execSync } = require('child_process');
const crypto = require('crypto');

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

function execQuery(sql) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  return execSync(`psql "${databaseUrl}" -t -c "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
  }).trim();
}

function genUUID() {
  return crypto.randomUUID();
}

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

    // Find user by email
    const userQuery = `SELECT id, primary_workspace_id FROM users WHERE email = '${email.replace(/'/g, "''")}'`;
    const userResult = execQuery(userQuery);

    let userId;
    if (!userResult) {
      // User not found, create one
      console.log(`\nUser with email "${email}" not found. Creating new user...`);
      const name = await question('User name: ');
      if (!name.trim()) {
        console.error('Error: User name is required');
        process.exit(1);
      }

      userId = genUUID();
      const now = new Date().toISOString();
      const createUserQuery = `INSERT INTO users (id, email, name, created_at, last_modified_at, last_modified_by) VALUES ('${userId}', '${email.replace(/'/g, "''")}', '${name.trim().replace(/'/g, "''")}', '${now}', '${now}', null)`;
      execQuery(createUserQuery);
      console.log(`✓ User created with ID: ${userId}`);
    } else {
      userId = userResult.split('|')[0].trim();
      const primaryWorkspaceId = userResult.split('|')[1]?.trim();

      // If this is the first workspace assignment, we'll set it as primary
      if (!primaryWorkspaceId || primaryWorkspaceId === '') {
        const now = new Date().toISOString();
        const updateUserQuery = `UPDATE users SET primary_workspace_id = '${workspaceId}', last_modified_at = '${now}' WHERE id = '${userId}'`;
        execQuery(updateUserQuery);
      }
    }

    // Check if workspace exists
    const workspaceQuery = `SELECT id FROM workspaces WHERE id = '${workspaceId}'`;
    const workspaceResult = execQuery(workspaceQuery);
    if (!workspaceResult) {
      console.error(`\nError: Workspace with ID "${workspaceId}" not found`);
      process.exit(1);
    }

    // Check if user is already in workspace
    const existingQuery = `SELECT role FROM workspace_users WHERE workspace_id = '${workspaceId}' AND user_id = '${userId}'`;
    const existingResult = execQuery(existingQuery);
    if (existingResult) {
      console.error(`\nError: User is already assigned to this workspace with role "${existingResult}"`);
      process.exit(1);
    }

    // Create the mapping
    const now = new Date().toISOString();
    const insertQuery = `INSERT INTO workspace_users (workspace_id, user_id, role, joined_at, last_modified_at, created_by, last_modified_by) VALUES ('${workspaceId}', '${userId}', '${role}', '${now}', '${now}', null, null)`;
    execQuery(insertQuery);

    console.log(`\n✓ User assigned to workspace with role "${role}"`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
