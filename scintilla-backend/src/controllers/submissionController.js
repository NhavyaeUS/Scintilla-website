const crypto = require('crypto');
const logger = require('../utils/logger');
const oneDriveService = require('../services/oneDriveService');
const excelService = require('../services/excelService');
const { fileTypeFromBuffer } = require('file-type');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 
  'image/webp', 'image/tiff', 'audio/mpeg', 'video/mp4', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain' // TXT
]);

/**
 * Sanitize internal error messages before including them in API responses.
 * Prevents leaking stack traces, file paths, or internal system details.
 */
function sanitizeErrorMessage(err) {
  const message = err instanceof Error ? err.message : String(err);
  // Map known internal error patterns to safe messages
  if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT') || message.includes('Graph API error')) {
    return 'Service temporarily unavailable';
  }
  if (message.includes('access token') || message.includes('authentication')) {
    return 'Authentication service error';
  }
  return 'Upload processing failed';
}

async function handleSubmission(req, res) {
  try {
    const totalSize = req.headers['content-length'];
    const { name, email, course, year } = req.body;
    const submissions = req.submissionsParsed;
    const files = req.files;

    logger.info("Content received", { requestId: req.id, ip: req.ip, file_count: files.length, total_bytes: totalSize });

    // Validate MIME types based on magic bytes
    for (const file of files) {
      const type = await fileTypeFromBuffer(file.buffer);
      // file-type can't detect text/plain via magic bytes (text has none),
      // so fall back to checking the extension for .txt files
      const detectedMime = type?.mime
        || (file.originalname.toLowerCase().endsWith('.txt') ? 'text/plain' : null);
      if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
        logger.warn("Validation failed", { requestId: req.id, ip: req.ip, failed_field: "files", rejection_reason: "Unsupported MIME type" });
        return res.status(415).json({
          status: "error",
          code: "UNSUPPORTED_MEDIA",
          message: "One or more files have unsupported media types.",
          field: "files"
        });
      }
    }

    // Higher entropy submission ID: 8 random bytes = 16 hex chars (2^64 possibilities)
    const unixTimestamp = Math.floor(Date.now() / 1000);
    const randomHex = crypto.randomBytes(8).toString('hex');
    const submissionId = `sub_${unixTimestamp}_${randomHex}`;
    
    let entries = [];
    let hasFailedEntries = false;

    // Process each file
    for (let i = 0; i < submissions.length; i++) {
      const submissionData = submissions[i];
      const file = files[i];

      let oneDriveUrl = null;
      let excelRow = null;
      let oneDriveError = null;
      let excelError = null;

      // 1. Upload to OneDrive
      try {
        oneDriveUrl = await oneDriveService.uploadFile(
          file, 
          name, 
          submissionData.category, 
          submissionData.title,
          submissionId
        );
      } catch (err) {
        oneDriveError = err;
      }

      // 2. Add to Excel if OneDrive upload was successful
      if (oneDriveUrl) {
        try {
          const rowData = [
            submissionId, 
            new Date().toISOString(), 
            name, 
            email, 
            course, 
            year, 
            submissionData.category, 
            submissionData.title, 
            submissionData.description || "", 
            oneDriveUrl
          ];
          excelRow = await excelService.appendRow(rowData, submissionId);
        } catch (err) {
          excelError = err;
        }
      }

      // Clear file buffer to free memory as soon as we're done with each file
      file.buffer = null;

      if (oneDriveError || excelError) {
        hasFailedEntries = true;
        const rawError = oneDriveError || excelError;
        logger.error("Submission entry failed", {
          requestId: req.id,
          submissionId,
          index: i,
          error: rawError.message,
          stack: rawError.stack,
        });
        entries.push({
          title: submissionData.title,
          category: submissionData.category,
          // Sanitized error — never expose internal details to the client
          error: sanitizeErrorMessage(rawError)
        });
      } else {
        entries.push({
          title: submissionData.title,
          category: submissionData.category,
          driveUrl: oneDriveUrl,
          sheetRow: excelRow
        });
        logger.info("Submission success", { requestId: req.id, submissionId, oneDriveUrl, excelRow });
      }
    }

    if (hasFailedEntries && entries.some(e => e.driveUrl)) {
      return res.status(207).json({ // Multi-status
        status: "partial_success",
        submissionId: submissionId,
        entries: entries
      });
    } else if (hasFailedEntries && entries.every(e => !e.driveUrl)) {
      return res.status(500).json({
        status: "error",
        code: "INTERNAL_ERROR",
        message: "Failed to process submissions. Please try again later.",
        submissionId: submissionId,
        entries: entries
      });
    }

    res.status(200).json({
      status: "success",
      message: "Submission received.",
      submissionId: submissionId,
      entries: entries
    });

  } catch (err) {
    logger.error("Submission failed", { requestId: req.id, error: err.message, stack: err.stack });
    res.status(500).json({ status: "error", code: "SERVER_ERROR", message: "Unexpected server error." });
  }
}

module.exports = { handleSubmission };
