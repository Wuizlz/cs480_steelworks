/**
 * PostgreSQL connection pool helpers.
 *
 * The pool is shared to reuse connections efficiently and avoid
 * opening a new TCP connection for every request.
 */

import { Pool, PoolClient } from "pg";
import { config } from "../config";

/**
 * Create a new pg Pool instance using validated configuration.
 *
 * Time complexity: O(1) because it allocates a single pool object.
 * Space complexity: O(1) because it stores a fixed-size config.
 */
export function createPool(): Pool {
  // The Pool manages client connections internally.
  return new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    ssl: config.pg.ssl.enabled
      ? { rejectUnauthorized: config.pg.ssl.rejectUnauthorized }
      : undefined,
  });
}

/**
 * Run a callback with a dedicated client and ensure release.
 *
 * Time complexity: O(1) plus whatever work the callback does.
 * Space complexity: O(1) because it allocates a single client reference.
 */
export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  // Acquire a client from the pool.
  const client = await pool.connect();

  try {
    // Run the caller's logic while holding the client.
    return await fn(client);
  } finally {
    // Always release the client to avoid connection leaks.
    client.release();
  }
}
