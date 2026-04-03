// Centralised environment variable access
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Microsoft Azure AD / Graph API credentials
  msTenantId: process.env.MS_TENANT_ID,
  msClientId: process.env.MS_CLIENT_ID,
  msClientSecret: process.env.MS_CLIENT_SECRET,

  // Microsoft OneDrive configuration
  msDriveUserId: process.env.MS_DRIVE_USER_ID,
  msOneDriveRootFolder: process.env.MS_ONEDRIVE_ROOT_FOLDER || 'ScintillaSubmissions',

  // Microsoft Excel workbook configuration
  msExcelWorkbookPath: process.env.MS_EXCEL_WORKBOOK_PATH || 'ScintillaSubmissions/Submissions.xlsx',
  msExcelTableName: process.env.MS_EXCEL_TABLE_NAME || 'Submissions',

  // Security
  statusBearerToken: process.env.STATUS_BEARER_TOKEN,
  allowedOrigins: process.env.ALLOWED_ORIGINS || ''
};
