require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const oneDriveService = require('./src/services/oneDriveService');

const PORT = process.env.PORT || 3000;

let server;

async function startServer() {
  try {
    // Ensure OneDrive folders exist before handling requests
    await oneDriveService.ensureFolders();
    logger.info("OneDrive folders verified on startup");

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to verify OneDrive folders, but starting server anyway", { error: error.message });
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (without verified OneDrive connection)`);
    });
  }
}

/**
 * Graceful shutdown handler.
 * Closes the HTTP server (stops accepting new connections),
 * waits for existing connections to finish, then exits cleanly.
 */
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
        process.exit(1);
      }
      logger.info('Server closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 10 seconds if connections don't close
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections — log and exit instead of silently crashing
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Exit with failure code — let process manager (PM2, systemd) restart
  process.exit(1);
});

// Handle uncaught exceptions — log and exit
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });
  // Exit with failure code — the process is in an undefined state
  process.exit(1);
});

startServer();
