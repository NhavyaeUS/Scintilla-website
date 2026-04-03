/**
 * OneDrive Service — replaces Google Drive Service
 * 
 * Uses Microsoft Graph API to:
 *   - Ensure category folders exist under a root folder in OneDrive
 *   - Upload files to the correct category folder
 *   - Create shareable links for uploaded files
 */
const logger = require('../utils/logger');
const { buildFileName } = require('../utils/fileRenamer');
const { withRetry } = require('../utils/retry');
const { getAccessToken } = require('./graphAuth');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// The user who owns the OneDrive. This can be a user principal name (email)
// or the special value 'me' (only works with delegated auth, not client credentials).
// For client credentials, use: /users/{userId}/drive
const DRIVE_USER_ID = process.env.MS_DRIVE_USER_ID; // e.g. "user@yourtenant.onmicrosoft.com"
const ROOT_FOLDER_PATH = process.env.MS_ONEDRIVE_ROOT_FOLDER || 'ScintillaSubmissions';

// In-memory cache of category folder item IDs
const categoryFolders = new Map();

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

  // For 204 No Content responses (e.g. permission updates)
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
 * Ensure a folder exists at the given path under the root.
 * Uses the "create folder if not exists" pattern via Graph API.
 * @param {string} folderName
 * @returns {Promise<string>} folder item ID
 */
async function ensureFolder(folderName) {
  try {
    // Try to get the folder first
    const existing = await graphRequest(
      `${drivePrefix()}/root:/${ROOT_FOLDER_PATH}/${folderName}`
    );
    return existing.id;
  } catch (err) {
    if (err.status === 404) {
      // Folder doesn't exist — create it
      // First ensure root folder exists
      try {
        await graphRequest(`${drivePrefix()}/root:/${ROOT_FOLDER_PATH}`);
      } catch (rootErr) {
        if (rootErr.status === 404) {
          // Create root folder
          await graphRequest(`${drivePrefix()}/root/children`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: ROOT_FOLDER_PATH,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'fail'
            })
          });
        } else {
          throw rootErr;
        }
      }

      // Create the category subfolder
      const rootFolder = await graphRequest(`${drivePrefix()}/root:/${ROOT_FOLDER_PATH}`);
      const created = await graphRequest(`${drivePrefix()}/items/${rootFolder.id}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail'
        })
      });
      return created.id;
    }
    throw err;
  }
}

/**
 * Ensure all category folders exist in OneDrive on startup.
 * Mirrors the Google Drive ensureFolders() method.
 */
async function ensureFolders() {
  const categories = ['Poetry', 'Articles', 'Artwork', 'Photography', 'Fiction', 'Non-Fiction'];
  for (const cat of categories) {
    const folderId = await ensureFolder(cat);
    categoryFolders.set(cat.toLowerCase().replace(/[^a-z]/g, ''), folderId);
    logger.info(`OneDrive folder ensured: ${cat}`, { folderId });
  }
}

/**
 * Upload a file to OneDrive and return a sharing link.
 * 
 * For files ≤ 4MB, uses simple PUT upload.
 * For files > 4MB, uses upload session (resumable upload).
 * 
 * @param {Object} file - Multer file object with buffer, originalname, mimetype
 * @param {string} submitterName
 * @param {string} category
 * @param {string} title
 * @param {string} submissionId
 * @returns {Promise<string>} Shareable OneDrive link
 */
async function uploadFile(file, submitterName, category, title, submissionId) {
  return await withRetry(async () => {
    const fileName = buildFileName(submitterName, category, title, file.originalname);
    const catKey = category.toLowerCase().replace(/[^a-z]/g, '');
    const folderId = categoryFolders.get(catKey);

    if (!folderId) {
      throw new Error(`Category folder not found for: ${category}`);
    }

    let uploadedItem;

    if (file.buffer.length <= 4 * 1024 * 1024) {
      // Simple upload for files ≤ 4MB
      uploadedItem = await graphRequest(
        `${drivePrefix()}/items/${folderId}:/${fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': file.mimetype
          },
          body: file.buffer
        }
      );
    } else {
      // Create upload session for large files (> 4MB)
      const session = await graphRequest(
        `${drivePrefix()}/items/${folderId}:/${fileName}:/createUploadSession`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item: {
              '@microsoft.graph.conflictBehavior': 'rename',
              name: fileName
            }
          })
        }
      );

      // Upload the entire buffer in one range request
      // (For very large files, you'd chunk this, but 25MB max fits in a single range)
      const uploadUrl = session.uploadUrl;
      const fileSize = file.buffer.length;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`
        },
        body: file.buffer
      });

      if (!uploadResponse.ok) {
        const errData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Upload session failed: ${uploadResponse.status}`);
      }

      uploadedItem = await uploadResponse.json();
    }

    // Create a sharing link (anonymous read link)
    const shareResult = await graphRequest(
      `${drivePrefix()}/items/${uploadedItem.id}/createLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'view',
          scope: 'anonymous'
        })
      }
    );

    const shareUrl = shareResult.link?.webUrl || uploadedItem.webUrl;

    logger.info('File uploaded to OneDrive', {
      submissionId,
      fileName,
      category,
      fileId: uploadedItem.id,
      shareUrl
    });

    return shareUrl;
  }, 3);
}

/**
 * Health check — verify we can access the drive.
 */
async function checkHealth() {
  try {
    await graphRequest(`${drivePrefix()}/root`);
    return true;
  } catch (err) {
    logger.error('OneDrive health check failed', { error: err.message });
    return false;
  }
}

module.exports = { ensureFolders, uploadFile, checkHealth };
