const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission } = require('../src/middleware/validate');

function createMockReqRes(body, files = []) {
  const req = {
    body,
    files,
    ip: '127.0.0.1',
    id: 'test-req-id'
  };
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
  return { req, res };
}

describe('validateSubmission middleware', () => {
  it('should accept valid submission payload', (t, done) => {
    const validBody = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'BTech CSE (IoT)',
      year: '3',
      submissions: JSON.stringify([
        { category: 'poetry', title: 'Moonlight', description: 'A short poem' }
      ])
    };
    const mockFiles = [{ originalname: 'moonlight.pdf', buffer: Buffer.from('test') }];
    const { req, res } = createMockReqRes(validBody, mockFiles);

    validateSubmission(req, res, () => {
      assert.equal(res.statusCode, 200);
      assert.equal(req.submissionsParsed.length, 1);
      assert.equal(req.submissionsParsed[0].title, 'Moonlight');
      done();
    });
  });

  it('should reject email from non-snuchennai.edu.in domain', () => {
    const invalidBody = {
      name: 'John Doe',
      email: 'john@gmail.com',
      course: 'BTech CSE (IoT)',
      year: '3',
      submissions: JSON.stringify([
        { category: 'poetry', title: 'Moonlight' }
      ])
    };
    const { req, res } = createMockReqRes(invalidBody, [{ originalname: 'a.pdf', buffer: Buffer.from('a') }]);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
    assert.ok(res.jsonData.message.includes('Only @snuchennai.edu.in email addresses are allowed'));
  });

  it('should reject unwhitelisted course', () => {
    const invalidBody = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'Random Nonexistent Degree',
      year: '3',
      submissions: JSON.stringify([
        { category: 'poetry', title: 'Moonlight' }
      ])
    };
    const { req, res } = createMockReqRes(invalidBody, [{ originalname: 'a.pdf', buffer: Buffer.from('a') }]);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
  });

  it('should reject invalid year', () => {
    const invalidBody = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'BTech CSE (IoT)',
      year: '5',
      submissions: JSON.stringify([
        { category: 'poetry', title: 'Moonlight' }
      ])
    };
    const { req, res } = createMockReqRes(invalidBody, [{ originalname: 'a.pdf', buffer: Buffer.from('a') }]);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
  });

  it('should reject file count mismatch', () => {
    const body = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'BTech CSE (IoT)',
      year: '2',
      submissions: JSON.stringify([
        { category: 'poetry', title: 'Poem 1' },
        { category: 'fiction', title: 'Story 1' }
      ])
    };
    // Only 1 file for 2 submissions
    const { req, res } = createMockReqRes(body, [{ originalname: 'a.pdf', buffer: Buffer.from('a') }]);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
    assert.ok(res.jsonData.message.includes('Number of uploaded files does not match'));
  });

  it('should reject invalid JSON submissions', () => {
    const body = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'BTech CSE (IoT)',
      year: '2',
      submissions: 'NOT_VALID_JSON'
    };
    const { req, res } = createMockReqRes(body, [{ originalname: 'a.pdf', buffer: Buffer.from('a') }]);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
  });

  it('should reject more than 10 submissions', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      category: 'poetry',
      title: `Poem ${i}`
    }));
    const body = {
      name: 'John Doe',
      email: 'john@snuchennai.edu.in',
      course: 'BTech CSE (IoT)',
      year: '1',
      submissions: JSON.stringify(items)
    };
    const { req, res } = createMockReqRes(body, []);

    validateSubmission(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.code, 'VALIDATION_FAILED');
    assert.ok(res.jsonData.message.includes('Maximum 10 submissions'));
  });
});
