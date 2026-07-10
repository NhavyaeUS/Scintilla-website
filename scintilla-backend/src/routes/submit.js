const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { validateSubmission } = require('../middleware/validate');
const { submitLimiter } = require('../middleware/rateLimiter');
const submissionController = require('../controllers/submissionController');
const logger = require('../utils/logger');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff',
  '.mp3', '.mp4', '.docx', '.txt'
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    fieldSize: 10 * 1024 * 1024, // 10MB max metadata
    files: 10 // Let's limit arbitrary number to say 10
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' is not allowed`), false);
    }
  }
});

// Middleware to trap multer limit errors
const uploadMiddleware = (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const totalSize = req.headers['content-length'];
        logger.warn("Payload large", { ip: req.ip, file_count: 'Unknown', total_bytes: totalSize });
        return res.status(413).json({ status: "error", code: "PAYLOAD_TOO_LARGE", message: "File exceeds 25 MB limit" });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        logger.warn("Too many files", { ip: req.ip });
        return res.status(400).json({ status: "error", code: "TOO_MANY_FILES", message: "Maximum 10 files allowed" });
      }
      return res.status(400).json({ status: "error", message: err.message });
    }
    
    // Check total request body limit heuristically or via content length
    const totalSize = parseInt(req.headers['content-length'] || 0, 10);
    if (totalSize > 75 * 1024 * 1024) { // 75 MB total request body limit
      logger.warn("Payload large", { ip: req.ip, file_count: req.files ? req.files.length : 0, total_bytes: totalSize });
      return res.status(413).json({ status: "error", code: "PAYLOAD_TOO_LARGE", message: "Request exceeds 75 MB limit" });
    }
    
    next();
  });
};

router.post('/', submitLimiter, uploadMiddleware, validateSubmission, submissionController.handleSubmission);

module.exports = router;

