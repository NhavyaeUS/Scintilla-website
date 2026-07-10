const rateLimit = require("express-rate-limit");
const logger = require('../utils/logger');

/**
 * Global rate limiter — 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded (global)", { ip: req.ip, path: req.path });
    res.status(429).json({ status: "error", code: "RATE_LIMITED", message: "Too many requests" });
  }
});

/**
 * Submission rate limiter — 5 submissions per 15 minutes per IP.
 * Prevents abuse of the file upload endpoint.
 */
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded (submit)", { ip: req.ip });
    res.status(429).json({ status: "error", code: "RATE_LIMITED", message: "Too many submissions. Please try again later." });
  }
});

/**
 * Status endpoint rate limiter — 10 requests per 15 minutes per IP.
 * Prevents brute-force token guessing.
 */
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded (status)", { ip: req.ip });
    res.status(429).json({ status: "error", code: "RATE_LIMITED", message: "Too many requests" });
  }
});

module.exports = { globalLimiter, submitLimiter, statusLimiter };
