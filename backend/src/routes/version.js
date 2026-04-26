const express = require('express');
const router = express.Router();
const { version } = require('../../package.json');

router.get('/', (req, res) => {
  res.json({
    version,
    environment: process.env.NODE_ENV || 'development',
    commit:      process.env.GIT_COMMIT || 'unknown',
  });
});

module.exports = router;
