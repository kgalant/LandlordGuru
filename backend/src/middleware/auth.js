const jwt = require('jsonwebtoken');

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
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { requireAuth };
