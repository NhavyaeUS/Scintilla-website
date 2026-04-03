const Joi = require('joi');
const logger = require('../utils/logger');

const submissionSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  course: Joi.string().required(),
  year: Joi.string().required(),
  submissions: Joi.string().required() // We'll parse this string into JSON and validate the array items next
});

const submissionItemSchema = Joi.object({
  category: Joi.string().valid('poetry', 'articles', 'artwork', 'photography', 'fiction', 'nonfiction').required(),
  title: Joi.string().max(120).required(),
  description: Joi.string().max(500).allow('', null)
});

const validateSubmission = (req, res, next) => {
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

  // Validate each item
  for (let i = 0; i < submissionsParsed.length; i++) {
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
