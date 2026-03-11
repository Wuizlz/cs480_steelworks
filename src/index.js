"use strict";
/**
 * Service entry point.
 *
 * Starts the HTTP server and wires graceful shutdown to release
 * database resources cleanly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("./sentry");
const app_1 = require("./app");
const config_1 = require("./config");
const pool_1 = require("./db/pool");
const logger_1 = require("./logging/logger");
(0, logger_1.configureLogger)({
    environment: config_1.config.environment,
    level: config_1.config.logging.level,
    consoleLevel: config_1.config.logging.consoleLevel,
    logDir: config_1.config.logging.logDir,
    fileName: config_1.config.logging.fileName,
    maxBytes: config_1.config.logging.maxBytes,
    maxFiles: config_1.config.logging.maxFiles,
    enableFileLogging: config_1.config.logging.enableFileLogging,
});
const logger = (0, logger_1.getLogger)("index");
logger.info("Application startup", {
    environment: config_1.config.environment,
    port: config_1.config.port,
    log_dir: config_1.config.logging.logDir,
    log_file: config_1.config.logging.fileName,
    sentry_enabled: Boolean(config_1.config.sentry.dsn),
});
// Create the database pool shared across requests.
const pool = (0, pool_1.createPool)();
// Build the Express app with its dependencies.
const app = (0, app_1.createApp)(pool);
// Start listening for HTTP requests.
const server = app.listen(config_1.config.port, () => {
    logger.info("HTTP server listening", { port: config_1.config.port });
});
/**
 * Gracefully shut down the server and database pool.
 *
 * Time complexity: O(1) aside from closing active connections.
 * Space complexity: O(1).
 */
async function shutdown(signal) {
    logger.info("Received shutdown signal", { signal });
    // Stop accepting new connections.
    server.close(async () => {
        // Close the database pool to release TCP connections.
        try {
            await pool.end();
            logger.info("Shutdown complete", { signal });
            process.exit(0);
        }
        catch (error) {
            logger.error("Failed to close database pool during shutdown", {
                signal,
                ...(0, logger_1.toErrorMeta)(error),
            });
            process.exit(1);
        }
    });
}
// Handle termination signals for clean shutdown.
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", (0, logger_1.toErrorMeta)(error));
});
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
        reason: reason instanceof Error ? (0, logger_1.toErrorMeta)(reason) : String(reason),
    });
});
