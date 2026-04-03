const crypto = require('crypto');
const logger = require('../utils/logger');
const oneDriveService = require('../services/oneDriveService');
const excelService = require('../services/excelService');
const fileType = require('file-type');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 
  'image/webp', 'image/tiff', 'audio/mpeg', 'video/mp4', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain' // TXT
]);

async function handleSubmission(req, res) {
  try {
    const totalSize = req.headers['content-length'];
    const { name, email, course, year } = req.body;
    const submissions = req.submissionsParsed;
    const files = req.files;

    logger.info("Content received", { ip: req.ip, file_count: files.length, total_bytes: totalSize });

    // Validate MIME types based on magic bytes
    for (const file of files) {
      const type = await fileType.fromBuffer(file.buffer);
      if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
        logger.warn("Validation failed", { ip: req.ip, failed_field: "files", rejection_reason: "Unsupported MIME type" });
        return res.status(415).json({
          status: "error",
          code: "UNSUPPORTED_MEDIA",
          message: "One or more files have unsupported media types.",
          field: "files"
        });
      }
    }

    const unixTimestamp = Math.floor(Date.now() / 1000);
    const randomHex6 = crypto.randomBytes(3).toString('hex');
    const submissionId = `sub_${unixTimestamp}_${randomHex6}`;
    
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
        oneDriveError = err.message;
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
          excelError = err.message;
        }
      }

      if (oneDriveError || excelError) {
        hasFailedEntries = true;
        entries.push({
          title: submissionData.title,
          category: submissionData.category,
          error: oneDriveError || excelError
        });
      } else {
        entries.push({
          title: submissionData.title,
          category: submissionData.category,
          driveUrl: oneDriveUrl,
          sheetRow: excelRow
        });
        logger.info("Submission success", { submissionId, oneDriveUrl, excelRow });
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
        message: "Failed to upload any files to OneDrive or Excel.",
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
    logger.error("Submission failed", { error: err.message, stack: err.stack });
    res.status(500).json({ status: "error", code: "SERVER_ERROR", message: "Unexpected server error." });
  }
}

module.exports = { handleSubmission };
