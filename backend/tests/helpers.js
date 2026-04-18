const jwt = require('jsonwebtoken');

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID      = '00000000-0000-0000-0000-000000000002';

// Generate a valid JWT signed with the test secret
function makeToken(overrides = {}) {
  return jwt.sign(
    {
      user_id:      USER_ID,
      workspace_id: WORKSPACE_ID,
      role:         'owner',
      email:        'test@example.com',
      name:         'Test User',
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = { WORKSPACE_ID, USER_ID, makeToken };
