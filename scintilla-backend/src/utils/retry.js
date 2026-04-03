const logger = require('./logger');

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
      logger.warn("Retrying API call", { attempt, delay, error: err.message });
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = { withRetry };
