const rateLimit = require("express-rate-limit");
const logger = require('../utils/logger');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { ip: req.ip });
    res.status(429).json({ status: "error", code: "RATE_LIMITED", message: "Too many requests" });
  }
});

module.exports = limiter;
