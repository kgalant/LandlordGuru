const jwt = require('jsonwebtoken');
const Logger = require('../lib/logger');

const requireAuth = (req, res, next) => {
  // Try to get token from Authorization header or query param
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7); // Remove 'Bearer ' prefix
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.user_id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    req.workspace_id = decoded.workspace_id;

    // Inject logger (available on all authenticated requests as req.logger)
    const db = req.app.get('db');
    req.logger = new Logger({
      workspace_id: decoded.workspace_id,
      user_id: decoded.user_id,
      db,
      defaultLevel: process.env.LOGGER_DEFAULT_LEVEL || 'error',
    });

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { requireAuth };
