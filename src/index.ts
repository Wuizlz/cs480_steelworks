/**
 * Service entry point.
 *
 * Starts the HTTP server and wires graceful shutdown to release
 * database resources cleanly.
 */

import { createApp } from "./app";
import { config } from "./config";
import { createPool } from "./db/pool";
import { configureLogger, getLogger, toErrorMeta } from "./logging/logger";

configureLogger({
  environment: config.environment,
  level: config.logging.level,
  consoleLevel: config.logging.consoleLevel,
  logDir: config.logging.logDir,
  fileName: config.logging.fileName,
  maxBytes: config.logging.maxBytes,
  maxFiles: config.logging.maxFiles,
  enableFileLogging: config.logging.enableFileLogging,
});

const logger = getLogger("index");
logger.info("Application startup", {
  environment: config.environment,
  port: config.port,
  log_dir: config.logging.logDir,
  log_file: config.logging.fileName,
});

// Create the database pool shared across requests.
const pool = createPool();

// Build the Express app with its dependencies.
const app = createApp(pool);

// Start listening for HTTP requests.
const server = app.listen(config.port, () => {
  logger.info("HTTP server listening", { port: config.port });
});

/**
 * Gracefully shut down the server and database pool.
 *
 * Time complexity: O(1) aside from closing active connections.
 * Space complexity: O(1).
 */
async function shutdown(signal: string): Promise<void> {
  logger.info("Received shutdown signal", { signal });

  // Stop accepting new connections.
  server.close(async () => {
    // Close the database pool to release TCP connections.
    try {
      await pool.end();
      logger.info("Shutdown complete", { signal });
      process.exit(0);
    } catch (error) {
      logger.error("Failed to close database pool during shutdown", {
        signal,
        ...toErrorMeta(error),
      });
      process.exit(1);
    }
  });
}

// Handle termination signals for clean shutdown.
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", toErrorMeta(error));
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? toErrorMeta(reason) : String(reason),
  });
});
