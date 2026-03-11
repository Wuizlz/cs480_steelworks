# Understanding `src/config.ts`

This document explains how [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts) supplies configuration to the logging system.

This file does not emit logs itself. Its job is earlier than that. It decides
what the logger settings are before [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) calls `configureLogger(...)`.

## Why This File Matters for Logging

`src/logging/logger.ts` needs values like:

- `level`
- `consoleLevel`
- `logDir`
- `fileName`
- environment name

This file is where those values are derived from env vars, validated, given
defaults, and exported in a typed object.

Without this file:

- the logger would not know whether it is in development, test, or production
- the logger would not know where to write files
- the logger would not know its thresholds

## Full Code

```ts
/**
 * Application configuration and environment validation.
 *
 * This module centralizes env parsing so runtime failures are clear
 * and consistent across the codebase.
 */

import dotenv from "dotenv";
import { z } from "zod/v3";
import type { EnvironmentName, LogLevelName } from "./logging/logger";

// Load environment variables from .env into process.env.
dotenv.config();

const inferredNodeEnv =
  process.env.NODE_ENV ?? (process.env.JEST_WORKER_ID ? "test" : "development");

// Define a validation schema for required environment variables.
const envSchema = z.object({
  PGHOST: z.string().min(1),
  PGPORT: z.coerce.number().int().positive(),
  PGDATABASE: z.string().min(1),
  PGUSER: z.string().min(1),
  PGPASSWORD: z.string().min(1),
  PGSSL: z
    .string()
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined)),
  PGSSLREJECTUNAUTHORIZED: z
    .string()
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined)),
  PORT: z.coerce.number().int().positive().optional().default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
  LOG_CONSOLE_LEVEL: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .optional(),
  LOG_DIR: z.string().min(1).optional().default("logs"),
  LOG_FILE_NAME: z.string().min(1).optional().default("app.log"),
});

// Parse and validate environment variables once at startup.
const parsed = envSchema.safeParse({
  ...process.env,
  NODE_ENV: inferredNodeEnv,
});

if (!parsed.success) {
  // Fail fast with a readable error if env vars are missing or invalid.
  // This prevents hard-to-debug connection errors later.
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

function defaultLogLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "info";
  }

  if (environment === "test") {
    return "warn";
  }

  return "debug";
}

function defaultConsoleLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "warn";
  }

  if (environment === "test") {
    return "error";
  }

  return "debug";
}

/**
 * Strongly-typed configuration object used across the app.
 *
 * Time complexity: O(1) because this is just data access.
 * Space complexity: O(1) because it stores a fixed-size object.
 */
export const config = {
  pg: {
    host: parsed.data.PGHOST,
    port: parsed.data.PGPORT,
    database: parsed.data.PGDATABASE,
    user: parsed.data.PGUSER,
    password: parsed.data.PGPASSWORD,
    ssl: {
      enabled: parsed.data.PGSSL === "true",
      rejectUnauthorized: parsed.data.PGSSLREJECTUNAUTHORIZED === "true",
    },
  },
  port: parsed.data.PORT,
  environment: parsed.data.NODE_ENV,
  logging: {
    level: parsed.data.LOG_LEVEL ?? defaultLogLevel(parsed.data.NODE_ENV),
    consoleLevel:
      parsed.data.LOG_CONSOLE_LEVEL ??
      defaultConsoleLevel(parsed.data.NODE_ENV),
    logDir: parsed.data.LOG_DIR,
    fileName: parsed.data.LOG_FILE_NAME,
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 3,
    enableFileLogging: parsed.data.NODE_ENV !== "test",
  },
};
```

## Section 1: Load Environment Variables

```ts
import dotenv from "dotenv";
...
dotenv.config();
```

This loads values from `.env` into `process.env`.

Why that matters for logging:

- `LOG_LEVEL`
- `LOG_CONSOLE_LEVEL`
- `LOG_DIR`
- `LOG_FILE_NAME`
- `NODE_ENV`

all come from env variables or fall back from them.

So `dotenv.config()` is the first step that makes those values available.

## Section 2: Infer `NODE_ENV` Safely

```ts
const inferredNodeEnv =
  process.env.NODE_ENV ?? (process.env.JEST_WORKER_ID ? "test" : "development");
```

This is a small but important fallback.

It means:

- if `NODE_ENV` exists, use it
- otherwise, if Jest is running, assume `test`
- otherwise, assume `development`

Why this helps logging:

- production should not default to debug-style behavior
- tests should not write log files by default
- local development should be verbose if nothing else is configured

This is the first place where environment-specific logging behavior begins.

## Section 3: Validate the Logging Env Vars

```ts
LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
LOG_CONSOLE_LEVEL: z
  .enum(["debug", "info", "warn", "error", "silent"])
  .optional(),
LOG_DIR: z.string().min(1).optional().default("logs"),
LOG_FILE_NAME: z.string().min(1).optional().default("app.log"),
```

This schema does two things:

- validates the shape of the variables
- provides sensible defaults where needed

Why validation matters:

If someone sets:

```text
LOG_LEVEL=verbose
```

that is not a supported log level.

Without validation, the logger could behave unpredictably.
With validation, startup fails immediately with a clear error.

That is much better than getting a mysterious runtime bug later.

## Section 4: Fail Fast on Bad Config

```ts
const parsed = envSchema.safeParse({
  ...process.env,
  NODE_ENV: inferredNodeEnv,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}
```

This means:

- collect env vars
- apply the schema
- stop the app immediately if config is invalid

Why this helps logging specifically:

If logging configuration is invalid, you do not want the app half-starting with
unclear behavior. This file guarantees that startup either:

- gets a valid config object
- or stops right away

## Section 5: Logging Defaults by Environment

```ts
function defaultLogLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "info";
  }

  if (environment === "test") {
    return "warn";
  }

  return "debug";
}
```

This function controls the main logging threshold.

Behavior:

- production -> `info`
- test -> `warn`
- development -> `debug`

That means:

- production is quieter than development
- test is quieter than development
- development keeps detailed logs

Now the console default:

```ts
function defaultConsoleLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "warn";
  }

  if (environment === "test") {
    return "error";
  }

  return "debug";
}
```

This is stricter than the main log level in some environments.

Why that split is useful:

- file logs can keep richer history
- the terminal can stay cleaner

Common example:

- file threshold = `info`
- console threshold = `warn`

So `info` still gets written to disk, but the terminal only shows warnings and errors.

## Section 6: Build the Final `config.logging` Object

```ts
logging: {
  level: parsed.data.LOG_LEVEL ?? defaultLogLevel(parsed.data.NODE_ENV),
  consoleLevel:
    parsed.data.LOG_CONSOLE_LEVEL ??
    defaultConsoleLevel(parsed.data.NODE_ENV),
  logDir: parsed.data.LOG_DIR,
  fileName: parsed.data.LOG_FILE_NAME,
  maxBytes: 5 * 1024 * 1024,
  maxFiles: 3,
  enableFileLogging: parsed.data.NODE_ENV !== "test",
},
```

This is the object that gets passed into the logger later.

Here is what each field contributes:

- `level`
  the overall severity threshold
- `consoleLevel`
  the terminal output threshold
- `logDir`
  where the file will be created
- `fileName`
  the active log filename
- `maxBytes`
  rotation threshold
- `maxFiles`
  backup count
- `enableFileLogging`
  whether logs go to file at all

### Why `enableFileLogging` is tied to test mode

```ts
enableFileLogging: parsed.data.NODE_ENV !== "test",
```

This means tests do not write log files by default.

That keeps test runs from:

- polluting the repo with logs
- creating unstable filesystem side effects
- making test output harder to reason about

## Section 7: How This Reaches the Logger

This file does not call `LoggerManager` directly.

Instead the flow is:

1. `src/config.ts` builds `config.logging`
2. `src/index.ts` imports `config`
3. `src/index.ts` passes those values into `configureLogger(...)`
4. `src/logging/logger.ts` creates the active `LoggerManager`

So this file is the source of truth for logger settings, even though the actual
logger implementation lives elsewhere.

## Final Mental Model

You can think of `src/config.ts` as the policy source for logging.

It decides:

- what environment the app is in
- what the default thresholds should be
- where logs should live
- whether file logging is enabled

Then `src/index.ts` hands those decisions to the logging engine.
