require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const oneDriveService = require('./src/services/oneDriveService');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Ensure OneDrive folders exist before handling requests
    await oneDriveService.ensureFolders();
    logger.info("OneDrive folders verified on startup");

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();
