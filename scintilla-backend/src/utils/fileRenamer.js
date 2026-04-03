const path = require('path');

function buildFileName(name, category, title, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const sanitize = s => s.trim()
                         .replace(/[^a-zA-Z0-9\s]/g, "")
                         .replace(/\s+/g, "_")
                         .substring(0, 40);
  return `${sanitize(name)}_${sanitize(category)}_${sanitize(title)}${ext}`;
}

module.exports = { buildFileName };
