require('dotenv').config();
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://yourdomain.com,http://localhost:5500';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { corsOptions, permissionsPolicy, securityHeaders } = require('../src/middleware/security');

describe('security middleware', () => {
  it('should set Permissions-Policy header correctly', (t, done) => {
    const headers = {};
    const req = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      }
    };
    permissionsPolicy(req, res, () => {
      assert.ok(headers['Permissions-Policy']);
      assert.ok(headers['Permissions-Policy'].includes('camera=()'));
      assert.ok(headers['Permissions-Policy'].includes('microphone=()'));
      done();
    });
  });

  it('should configure CORS to allow whitelisted origins or requests with no origin', (t, done) => {
    corsOptions.origin(undefined, (err, allow) => {
      assert.equal(err, null);
      assert.equal(allow, true);
    });

    corsOptions.origin('http://localhost:5500', (err, allow) => {
      assert.equal(err, null);
      assert.equal(allow, true);
      done();
    });
  });

  it('should block non-whitelisted origins in CORS', (t, done) => {
    corsOptions.origin('https://malicious-site.com', (err, allow) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Not allowed by CORS');
      done();
    });
  });

  it('should define CSP and security directives in securityHeaders', () => {
    assert.ok(securityHeaders.contentSecurityPolicy);
    assert.equal(securityHeaders.noSniff, true);
    assert.equal(securityHeaders.frameguard.action, 'deny');
  });
});
