/**
 * Service entry point.
 *
 * Starts the HTTP server and wires graceful shutdown to release
 * database resources cleanly.
 */

import { createApp } from "./app";
import { config } from "./config";
import { createPool } from "./db/pool";

// Create the database pool shared across requests.
const pool = createPool();

// Build the Express app with its dependencies.
const app = createApp(pool);

// Start listening for HTTP requests.
const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${config.port}`);
});

/**
 * Gracefully shut down the server and database pool.
 *
 * Time complexity: O(1) aside from closing active connections.
 * Space complexity: O(1).
 */
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down...`);

  // Stop accepting new connections.
  server.close(async () => {
    // Close the database pool to release TCP connections.
    await pool.end();
    process.exit(0);
  });
}

// Handle termination signals for clean shutdown.
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
