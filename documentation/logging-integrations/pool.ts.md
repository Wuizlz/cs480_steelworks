# Understanding `src/db/pool.ts`

This document explains how [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts) integrates logging with the PostgreSQL connection pool.

This file is not the logger engine. It is the place where database connection
infrastructure becomes observable.

## Why This File Matters for Logging

This file contributes two important logging behaviors:

- it logs when the pool is created
- it logs unexpected pool-level database errors

That gives you visibility into the health of the database layer itself, not just
queries executed by services.

## Full Code

```ts
/**
 * PostgreSQL connection pool helpers.
 *
 * The pool is shared to reuse connections efficiently and avoid
 * opening a new TCP connection for every request.
 */

import { Pool, PoolClient } from "pg";
import { config } from "../config";
import { getLogger, toErrorMeta } from "../logging/logger";

const logger = getLogger("db.pool");

export function createPool(): Pool {
  const pool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    ssl: config.pg.ssl.enabled
      ? { rejectUnauthorized: config.pg.ssl.rejectUnauthorized }
      : undefined,
  });

  pool.on("error", (error) => {
    logger.error("Unexpected PostgreSQL pool error", toErrorMeta(error));
  });

  logger.info("PostgreSQL pool created", {
    host: config.pg.host,
    database: config.pg.database,
    ssl_enabled: config.pg.ssl.enabled,
  });

  return pool;
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
```

## Section 1: Module Logger

```ts
const logger = getLogger("db.pool");
```

This logger identity groups all pool-related messages under `db.pool`.

That makes the source of database infrastructure logs immediately obvious.

## Section 2: The Pool Uses `config.pg`

```ts
const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  database: config.pg.database,
  user: config.pg.user,
  password: config.pg.password,
  ssl: config.pg.ssl.enabled
    ? { rejectUnauthorized: config.pg.ssl.rejectUnauthorized }
    : undefined,
});
```

This is where the already-validated configuration from `src/config.ts` becomes a
real Postgres connection pool.

Logging relevance:

- the logger is attached to the same pool instance
- the creation log reflects the actual configuration being used

## Section 3: Pool Error Logging

```ts
pool.on("error", (error) => {
  logger.error("Unexpected PostgreSQL pool error", toErrorMeta(error));
});
```

This listens for pool-level errors from the `pg` library.

Important distinction:

- query-specific failures are usually logged in service code
- pool-level errors are infrastructure-level problems

Examples of why this matters:

- a client in the pool dies unexpectedly
- a network connection to the database is lost
- the pool emits an asynchronous error outside the normal request path

If this listener did not exist, those failures could be much harder to diagnose.

## Section 4: Pool Creation Log

```ts
logger.info("PostgreSQL pool created", {
  host: config.pg.host,
  database: config.pg.database,
  ssl_enabled: config.pg.ssl.enabled,
});
```

This log confirms that the database pool was initialized.

Why this is useful:

- it tells you which host/database the app thinks it is using
- it confirms whether SSL is enabled
- it helps prove startup completed past the DB-initialization stage

Notice that it does not log the password.

That is intentional and correct.

Logging should expose useful diagnostics, not secrets.

## Section 5: `withClient(...)`

```ts
export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
```

This helper does not currently log anything, but it is still part of the pool module.

What it does:

- acquires a dedicated client
- runs caller logic
- guarantees release in `finally`

Why it matters indirectly for logging:

- it makes database resource handling predictable
- fewer leaked clients means fewer mysterious DB failures later

So while this function is not a logging hook, it supports the stability of the
layer where pool errors would otherwise appear.

## Final Mental Model

You can think of `src/db/pool.ts` as the place where database connectivity becomes visible.

It gives you:

- a startup-time confirmation that the pool exists
- a runtime safety net for unexpected pool errors

That is its logging role.
