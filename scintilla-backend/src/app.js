require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { httpsRedirect, securityHeaders, corsOptions } = require('./middleware/security');
const rateLimiter = require('./middleware/rateLimiter');
const submitRoutes = require('./routes/submit');
const statusRoutes = require('./routes/status');

const app = express();

// Security middleware
app.disable('x-powered-by');
app.use(httpsRedirect);
app.use(helmet(securityHeaders));
app.use(cors(corsOptions));

// Rate limiting (Global)
app.use(rateLimiter);

// Parse JSON bodies (if needed) but mainly multipart is used via multer later
app.use(express.json());

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

module.exports = app;
