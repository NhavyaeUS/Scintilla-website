/**
 * auth.js — Microsoft JWT Token Validation Middleware
 *
 * Validates the Authorization: Bearer <token> header on incoming requests.
 * The token is a Microsoft identity access token issued via MSAL login in the browser.
 *
 * Checks performed:
 *   1. Token is present in the Authorization header
 *   2. Token signature is valid (verified against Microsoft's JWKS endpoint)
 *   3. Audience matches this app's client ID
 *   4. Tenant ID (tid claim) matches the expected Azure AD tenant
 *   5. Email/UPN ends in @snuchennai.edu.in
 *
 * On success: attaches req.user = { name, email } and calls next()
 * On failure: returns 401 with a safe error message
 */
const { createRemoteJWKSet, jwtVerify } = require('jose');
const logger = require('../utils/logger');

// These must match the Azure AD App Registration values in scintilla_login.html
const TENANT_ID = process.env.MS_TENANT_ID || '5beb351c-3fb8-418f-b612-fe36ace96ef3';
const CLIENT_ID = process.env.MS_CLIENT_ID || 'a70575c0-d17b-438a-b8cc-8341626ee44d';
const ALLOWED_EMAIL_DOMAIN = 'snuchennai.edu.in';

// Microsoft's JWKS endpoint for the tenant — used to verify token signatures
// This URL is standard for Azure AD tenants
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

// Cache the JWKS remote key set — jose handles key refresh automatically
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * Express middleware: validates Microsoft JWT and attaches req.user.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Auth rejected: missing or malformed Authorization header', {
      requestId: req.id,
      ip: req.ip,
    });
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authorization token required. Please sign in via the login page.',
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      // Accept both v1 and v2 token audiences
      audience: [CLIENT_ID, `api://${CLIENT_ID}`],
      issuer: [
        `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
        `https://sts.windows.net/${TENANT_ID}/`,
      ],
    });

    // Verify tenant ID claim — prevents tokens from other Azure AD tenants
    if (payload.tid && payload.tid !== TENANT_ID) {
      logger.warn('Auth rejected: tenant ID mismatch', {
        requestId: req.id,
        ip: req.ip,
        tid: payload.tid,
      });
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Access denied: invalid tenant.',
      });
    }

    // Extract email — Microsoft tokens use 'preferred_username' or 'upn' or 'email'
    const email = (
      payload.preferred_username ||
      payload.upn ||
      payload.email ||
      ''
    ).toLowerCase();

    // Verify email domain — must be @snuchennai.edu.in
    if (!email.endsWith('@' + ALLOWED_EMAIL_DOMAIN)) {
      logger.warn('Auth rejected: email domain not allowed', {
        requestId: req.id,
        ip: req.ip,
        email,
      });
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: `Access denied: only @${ALLOWED_EMAIL_DOMAIN} accounts are allowed.`,
      });
    }

    // Attach verified user info — controller will use this instead of req.body
    req.user = {
      name: payload.name || payload.given_name || email,
      email,
    };

    logger.info('Auth verified', { requestId: req.id, email });
    next();
  } catch (err) {
    // Token expired, signature invalid, or network error fetching JWKS
    logger.warn('Auth rejected: token validation failed', {
      requestId: req.id,
      ip: req.ip,
      error: err.message,
    });
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token. Please sign in again.',
    });
  }
}

module.exports = { requireAuth };
