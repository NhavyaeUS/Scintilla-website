require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const { httpsRedirect, securityHeaders, corsOptions, permissionsPolicy } = require('./middleware/security');
const { globalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const submitRoutes = require('./routes/submit');
const statusRoutes = require('./routes/status');

const app = express();

// Trust first proxy (needed for accurate req.ip behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.disable('x-powered-by');
app.use(httpsRedirect);
app.use(helmet(securityHeaders));
app.use(permissionsPolicy);
app.use(cors(corsOptions));

// Rate limiting (Global)
app.use(globalLimiter);

// Request ID middleware — generates a unique ID for every request for log correlation
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request timeout — prevents slowloris-style DoS attacks
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.error('Request timeout', { requestId: req.id, path: req.path, ip: req.ip });
      res.status(408).json({ status: 'error', code: 'REQUEST_TIMEOUT', message: 'Request timed out' });
    }
  }, REQUEST_TIMEOUT_MS);

  // Clear timer when response finishes
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
});

// Parse JSON bodies with size limit to prevent large JSON payloads
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/v1/submit', submitRoutes);
app.use('/api/v1/status', statusRoutes);

// Version Route
app.get('/api/v1/version', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', deploymentDate: new Date().toISOString() });
});

// General 404
app.use((req, res) => {
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Global error handler — catches unhandled errors, CORS rejections, JSON parse errors, etc.
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { requestId: req.id, error: err.message, stack: err.stack, path: req.path });
  res.status(err.status || 500).json({
    status: 'error',
    code: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

module.exports = app;
