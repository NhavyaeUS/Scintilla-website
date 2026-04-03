/**
 * Microsoft Graph API Authentication via MSAL (Client Credentials Flow)
 * 
 * Uses Azure AD App Registration with client_id + client_secret.
 * Tokens are cached by MSAL and refreshed automatically.
 */
const msal = require('@azure/msal-node');
const logger = require('../utils/logger');

const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  logger.error('Missing Microsoft Azure credentials. Set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET in .env');
}

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientSecret: CLIENT_SECRET
  },
  system: {
    loggerOptions: {
      loggerCallback: (loglevel, message) => {
        if (loglevel <= msal.LogLevel.Warning) {
          logger.debug('MSAL: ' + message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Warning
    }
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];

/**
 * Acquire an access token for Microsoft Graph API using client credentials.
 * MSAL caches the token and refreshes it automatically when it expires.
 * @returns {Promise<string>} Bearer access token
 */
async function getAccessToken() {
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes: GRAPH_SCOPES
    });

    if (!result || !result.accessToken) {
      throw new Error('Failed to acquire access token — empty result');
    }

    return result.accessToken;
  } catch (err) {
    logger.error('Failed to acquire Microsoft Graph access token', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { getAccessToken };
