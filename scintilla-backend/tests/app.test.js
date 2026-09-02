const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

describe('Express application routes', () => {
  it('should return version information on GET /api/v1/version', async () => {
    // Create an ephemeral server to test the actual endpoint
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/version`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.version, '1.0.0');
      assert.ok(data.deploymentDate);
    } finally {
      server.close();
    }
  });

  it('should return 404 for nonexistent endpoints', async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/nonexistent`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.code, 'NOT_FOUND');
    } finally {
      server.close();
    }
  });
});
