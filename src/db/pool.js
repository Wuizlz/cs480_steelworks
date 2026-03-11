"use strict";
/**
 * PostgreSQL connection pool helpers.
 *
 * The pool is shared to reuse connections efficiently and avoid
 * opening a new TCP connection for every request.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPool = createPool;
exports.withClient = withClient;
const pg_1 = require("pg");
const config_1 = require("../config");
const logger_1 = require("../logging/logger");
const logger = (0, logger_1.getLogger)("db.pool");
/**
 * Create a new pg Pool instance using validated configuration.
 *
 * Time complexity: O(1) because it allocates a single pool object.
 * Space complexity: O(1) because it stores a fixed-size config.
 */
function createPool() {
    // The Pool manages client connections internally.
    const pool = new pg_1.Pool({
        host: config_1.config.pg.host,
        port: config_1.config.pg.port,
        database: config_1.config.pg.database,
        user: config_1.config.pg.user,
        password: config_1.config.pg.password,
        ssl: config_1.config.pg.ssl.enabled
            ? { rejectUnauthorized: config_1.config.pg.ssl.rejectUnauthorized }
            : undefined,
    });
    pool.on("error", (error) => {
        logger.error("Unexpected PostgreSQL pool error", (0, logger_1.toErrorMeta)(error));
    });
    logger.info("PostgreSQL pool created", {
        host: config_1.config.pg.host,
        database: config_1.config.pg.database,
        ssl_enabled: config_1.config.pg.ssl.enabled,
    });
    return pool;
}
/**
 * Run a callback with a dedicated client and ensure release.
 *
 * Time complexity: O(1) plus whatever work the callback does.
 * Space complexity: O(1) because it allocates a single client reference.
 */
async function withClient(pool, fn) {
    // Acquire a client from the pool.
    const client = await pool.connect();
    try {
        // Run the caller's logic while holding the client.
        return await fn(client);
    }
    finally {
        // Always release the client to avoid connection leaks.
        client.release();
    }
}
