const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Strip control characters and null bytes from a string.
 * Prevents injection of invisible characters into filenames, metadata, etc.
 */
function sanitizeControlChars(str) {
  if (typeof str !== 'string') return str;
  // Remove ASCII control characters (0x00–0x1F, 0x7F) except common whitespace (tab, newline, carriage return)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Allowed courses — exact match to the frontend <select> options.
 */
const ALLOWED_COURSES = [
  'BTech CSE (IoT)',
  'BTech CSE (AIDS)',
  'BTech CSE (Cybersecurity)',
  'B.Com',
  'B.Sc Economics (Data Science)',
  'B.Com (Professional Accounting)',
  'B.Com / B.Com (Hons.)',
  '5-Year Integrated B.A., LL.B. Program',
];

const ALLOWED_YEARS = ['1', '2', '3', '4'];

const submissionSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .messages({ 'string.max': 'Name must be 100 characters or less' }),
  email: Joi.string().email().pattern(/@snuchennai\.edu\.in$/)
    .required()
    .messages({ 'string.pattern.base': 'Only @snuchennai.edu.in email addresses are allowed' }),
  course: Joi.string().valid(...ALLOWED_COURSES).required()
    .messages({ 'any.only': 'Invalid course selection' }),
  year: Joi.string().valid(...ALLOWED_YEARS).required()
    .messages({ 'any.only': 'Year must be 1, 2, 3, or 4' }),
  submissions: Joi.string().required() // We'll parse this string into JSON and validate the array items next
});

const submissionItemSchema = Joi.object({
  category: Joi.string().valid('poetry', 'articles', 'artwork', 'photography', 'fiction', 'nonfiction').required(),
  title: Joi.string().min(1).max(120).required(),
  description: Joi.string().max(500).allow('', null)
});

const MAX_SUBMISSIONS = 10; // Matches multer files limit

const validateSubmission = (req, res, next) => {
  // Sanitize control characters from all string fields before validation
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeControlChars(req.body[key]);
      }
    }
  }

  const { error } = submissionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    logger.warn("Validation failed", { ip: req.ip, failed_field: error.details[0].path.join('.'), rejection_reason: error.message });
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_FAILED",
      message: error.details.map(d => d.message).join(', '),
      field: error.details[0].path.join('.')
    });
  }

  // Parse submissions array
  let submissionsParsed = [];
  try {
    submissionsParsed = JSON.parse(req.body.submissions);
    if (!Array.isArray(submissionsParsed)) {
      throw new Error("submissions must be an array");
    }
  } catch (err) {
    logger.warn("Validation failed", { ip: req.ip, failed_field: "submissions", rejection_reason: "Invalid JSON array" });
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_FAILED",
      message: "submissions must be a valid JSON array",
      field: "submissions"
    });
  }

  // Enforce maximum submissions count
  if (submissionsParsed.length === 0) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_FAILED",
      message: "At least one submission is required",
      field: "submissions"
    });
  }

  if (submissionsParsed.length > MAX_SUBMISSIONS) {
    logger.warn("Validation failed", { ip: req.ip, failed_field: "submissions", rejection_reason: `Too many submissions: ${submissionsParsed.length}` });
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_FAILED",
      message: `Maximum ${MAX_SUBMISSIONS} submissions allowed per request`,
      field: "submissions"
    });
  }

  // Validate each item and sanitize control chars
  for (let i = 0; i < submissionsParsed.length; i++) {
    // Sanitize string fields in each submission item
    const item = submissionsParsed[i];
    if (item && typeof item === 'object') {
      for (const key of Object.keys(item)) {
        if (typeof item[key] === 'string') {
          item[key] = sanitizeControlChars(item[key]);
        }
      }
    }

    const itemError = submissionItemSchema.validate(submissionsParsed[i]).error;
    if (itemError) {
      logger.warn("Validation failed", { ip: req.ip, failed_field: `submissions[${i}]`, rejection_reason: itemError.message });
      return res.status(400).json({
        status: "error",
        code: "VALIDATION_FAILED",
        message: `submissions[${i}]: ${itemError.message}`,
        field: `submissions[${i}]`
      });
    }
  }

  // Check file count matches submissions length if files is required per submission
  if (!req.files || req.files.length !== submissionsParsed.length) {
    logger.warn("Validation failed", { ip: req.ip, failed_field: "files", rejection_reason: "File count mismatch" });
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_FAILED",
      message: "Number of uploaded files does not match the number of submissions",
      field: "files"
    });
  }

  req.submissionsParsed = submissionsParsed;
  next();
};

module.exports = { validateSubmission };
