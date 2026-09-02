const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildFileName } = require('../src/utils/fileRenamer');

describe('fileRenamer', () => {
  it('should format standard filename correctly', () => {
    const filename = buildFileName('Priya Sharma', 'poetry', 'Ode to Chennai', 'poem.pdf');
    assert.equal(filename, 'Priya_Sharma_poetry_Ode_to_Chennai.pdf');
  });

  it('should sanitize special characters and spaces', () => {
    const filename = buildFileName('John @ Doe!', 'artwork', 'My #1 Cool Art *', 'image.png');
    assert.equal(filename, 'John_Doe_artwork_My_1_Cool_Art.png');
  });

  it('should fallback to defaults when inputs are empty or fully stripped', () => {
    const filename = buildFileName('!!!', '$$$', '***', 'notes.txt');
    assert.equal(filename, 'Anonymous_General_Untitled.txt');
  });

  it('should reject disallowed extensions', () => {
    assert.throws(() => {
      buildFileName('Alice', 'poetry', 'Poem', 'malicious.exe');
    }, /Disallowed file extension/);

    assert.throws(() => {
      buildFileName('Alice', 'poetry', 'Poem', 'script.js');
    }, /Disallowed file extension/);

    assert.throws(() => {
      buildFileName('Alice', 'poetry', 'Poem', 'shell.sh');
    }, /Disallowed file extension/);
  });

  it('should allow all permitted extensions', () => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.mp3', '.mp4', '.docx', '.txt'];
    for (const ext of allowed) {
      const filename = buildFileName('User', 'articles', 'Title', `file${ext}`);
      assert.ok(filename.endsWith(ext));
    }
  });
});
