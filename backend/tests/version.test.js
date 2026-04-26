require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

const request = require('supertest');
const app     = require('../src/app');

afterAll(async () => {
  // no db used
});

describe('GET /api/version', () => {
  it('returns 200 with version, environment, and commit fields', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof res.body.environment).toBe('string');
    expect(typeof res.body.commit).toBe('string');
  });

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
  });

  it('returns "unknown" for commit when GIT_COMMIT is not set', async () => {
    const saved = process.env.GIT_COMMIT;
    delete process.env.GIT_COMMIT;
    const res = await request(app).get('/api/version');
    expect(res.body.commit).toBe('unknown');
    if (saved !== undefined) process.env.GIT_COMMIT = saved;
  });
});
