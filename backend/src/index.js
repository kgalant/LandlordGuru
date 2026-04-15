require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db/knex');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

app.get('/api/health', (req, res) => {
  const versionPath = path.join(FRONTEND_DIR, 'version.json');
  let version = 'unknown';
  try {
    version = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;
  } catch (_) {}
  res.json({ status: 'ok', version });
});

db.migrate.latest()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LandlordGuru backend listening on port ${PORT}`);

      db.raw('select 1')
        .then(() => console.log('DB connected'))
        .catch(err => console.warn('DB not available:', err.message));
    });
  })
  .catch(err => {
    console.error('Migration failed — server not started:', err.message);
    process.exit(1);
  });
