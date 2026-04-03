/**
 * Excel Service — replaces Google Sheets Service
 * 
 * Uses Microsoft Graph API to append rows to an Excel workbook
 * stored in OneDrive.
 * 
 * The workbook must have a table named "Submissions" in "Sheet1"
 * with columns: Name, Email, Course, Year, Category, Title, Description, FileLink, Timestamp
 */
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');
const { getAccessToken } = require('./graphAuth');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DRIVE_USER_ID = process.env.MS_DRIVE_USER_ID;
const WORKBOOK_PATH = process.env.MS_EXCEL_WORKBOOK_PATH || 'ScintillaSubmissions/Submissions.xlsx';
const TABLE_NAME = process.env.MS_EXCEL_TABLE_NAME || 'Submissions';

/**
 * Make an authenticated request to Microsoft Graph API.
 */
async function graphRequest(endpoint, options = {}) {
  const token = await getAccessToken();
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (response.status === 204) {
    return { ok: true };
  }

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message || `Graph API error: ${response.status}`;
    const err = new Error(errMsg);
    err.status = response.status;
    err.graphError = data?.error;
    throw err;
  }

  return data;
}

/**
 * Get the drive endpoint prefix for the configured user.
 */
function drivePrefix() {
  return `/users/${DRIVE_USER_ID}/drive`;
}

/**
 * Append a row to the Excel workbook table.
 * 
 * Row data format: [submissionId, timestamp, name, email, course, year, category, title, description, fileLink]
 * 
 * @param {Array} rowData - Array of values matching table columns
 * @param {string} submissionId - For logging
 * @returns {Promise<string>} confirmation string
 */
async function appendRow(rowData, submissionId) {
  return await withRetry(async () => {
    const endpoint = `${drivePrefix()}/root:/${WORKBOOK_PATH}:/workbook/tables/${TABLE_NAME}/rows/add`;

    const result = await graphRequest(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [rowData]
      })
    });

    logger.info('Row appended to Excel workbook', {
      submissionId,
      index: result.index
    });

    return `Sheet1!Row${(result.index || 0) + 2}`; // +2 because index is 0-based and row 1 is headers
  }, 3);
}

/**
 * Health check — verify we can access the workbook.
 */
async function checkHealth() {
  try {
    await graphRequest(
      `${drivePrefix()}/root:/${WORKBOOK_PATH}:/workbook/tables/${TABLE_NAME}`
    );
    return true;
  } catch (err) {
    logger.error('Excel health check failed', { error: err.message });
    return false;
  }
}

module.exports = { appendRow, checkHealth };
