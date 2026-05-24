// Only load .env if not already loaded by the test suite
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1); // Trust X-Forwarded-* headers from nginx
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
app.use(express.json());

app.use(
  session({
    secret: process.env.JWT_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.use('/auth', require('./routes/auth'));

// API routes
app.use('/api/properties',   require('./routes/properties'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/rules',               require('./routes/rules'));
app.use('/api/split-rules',         require('./routes/split-rules'));
app.use('/api/description-mappings', require('./routes/description-mappings'));
app.use('/api/workspace',        require('./routes/workspace'));
app.use('/api/accounts',        require('./routes/accounts'));
app.use('/api/currency-rates',  require('./routes/currency-rates'));
app.use('/api/reports',         require('./routes/reports'));
app.use('/api/version',         require('./routes/version'));

// UI config CSS — exposes env-controlled CSS custom properties to the frontend
app.get('/ui-config.css', (req, res) => {
  const chars = Math.max(10, parseInt(process.env.APP_SELECT_CHAR_WIDTH) || 25);
  res.set('Cache-Control', 'no-cache');
  res.type('text/css');
  res.send(`:root { --select-char-width: ${chars}ch; }\n`);
});

// Static files
app.use(express.static(FRONTEND_DIR));

app.get('/api/health', (req, res) => {
  const versionPath = path.join(FRONTEND_DIR, 'version.json');
  let version = 'unknown';
  try {
    version = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;
  } catch (_) {}
  res.json({ status: 'ok', version });
});

module.exports = app;
