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
  const sanitize = s => s.trim()
                         .replace(/[^a-zA-Z0-9\s]/g, "")
                         .replace(/\s+/g, "_")
                         .substring(0, 40);
  return `${sanitize(name)}_${sanitize(category)}_${sanitize(title)}${ext}`;
}

module.exports = { buildFileName };
