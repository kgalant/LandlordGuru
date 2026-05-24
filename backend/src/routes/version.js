const express = require('express');
const router = express.Router();
const { version } = require('../../package.json');

router.get('/', (req, res) => {
  res.json({
    version,
    environment:   process.env.APP_ENV          || process.env.NODE_ENV || 'development',
    title_suffix:  process.env.APP_TITLE_SUFFIX || '',
    commit:        process.env.GIT_COMMIT       || 'unknown',
  });
});

module.exports = router;
