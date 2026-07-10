const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const oneDriveService = require('../services/oneDriveService');
const excelService = require('../services/excelService');
const { statusLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

/**
 * Timing-safe bearer token check middleware.
 * Uses crypto.timingSafeEqual to prevent timing attacks
 * that could leak token characters through response time analysis.
 */
const requireToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.error("Auth error", { endpoint: "/api/v1/status", header_present: !!authHeader });
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  const expectedToken = process.env.STATUS_BEARER_TOKEN || "";

  // Timing-safe comparison: prevents timing attacks by ensuring
  // comparison takes constant time regardless of where characters differ
  if (token.length !== expectedToken.length) {
    logger.error("Auth error", { endpoint: "/api/v1/status", header_present: true });
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }

  const tokenBuffer = Buffer.from(token, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');

  if (!crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    logger.error("Auth error", { endpoint: "/api/v1/status", header_present: true });
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }

  next();
};

router.get('/', statusLimiter, requireToken, async (req, res) => {
  try {
    const oneDriveStatus = await oneDriveService.checkHealth();
    const excelStatus = await excelService.checkHealth();

    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
      services: {
        oneDrive: oneDriveStatus ? "connected" : "disconnected",
        excel: excelStatus ? "connected" : "disconnected"
      }
    });
  } catch (err) {
    logger.error("Status health check failed", { error: err.message });
    res.status(500).json({ status: "error", message: "Internal server error during health check" });
  }
});

module.exports = router;
