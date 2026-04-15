#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { execSync } = require('child_process');

const workspaceName = process.argv[2];

if (!workspaceName) {
  console.error('Usage: node scripts/create-workspace.js <workspace-name>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

try {
  const now = new Date().toISOString();
  const sql = `INSERT INTO workspaces (name, created_at, last_modified_at) VALUES ('${workspaceName.replace(/'/g, "''")}', '${now}', '${now}') RETURNING id;`;

  const result = execSync(`psql "${databaseUrl}" -t -c "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
  }).trim();

  const workspaceId = result.split('\n')[0].trim();
  if (!workspaceId) {
    throw new Error('No workspace ID returned from database');
  }

  console.log(workspaceId);
  process.exit(0);
} catch (err) {
  console.error('Error creating workspace:', err.message);
  process.exit(1);
}
