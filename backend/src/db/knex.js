require('dotenv').config();
const knex = require('knex');
const path = require('path');
const { types } = require('pg');

// Return DATE columns as plain YYYY-MM-DD strings, not JS Date objects
// (avoids timezone-shift when the pg client converts UTC midnight to local time)
types.setTypeParser(1082, (val) => val);

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  console.error('Please create a backend/.env file with a valid database connection string.');
  console.error('Example: DATABASE_URL=postgresql://user:password@localhost:5432/landlordguru_dev');
  process.exit(1);
}

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
  },
});

module.exports = db;
