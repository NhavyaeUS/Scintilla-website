const path = require('path');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff',
  '.mp3', '.mp4', '.docx', '.txt'
]);

function buildFileName(name, category, title, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Disallowed file extension: ${ext}`);
  }
  const sanitize = s => (s || '')
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 40);

  const cleanName = sanitize(name) || 'Anonymous';
  const cleanCategory = sanitize(category) || 'General';
  const cleanTitle = sanitize(title) || 'Untitled';

  return `${cleanName}_${cleanCategory}_${cleanTitle}${ext}`;
}

module.exports = { buildFileName };
