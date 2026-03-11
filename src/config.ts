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
  SENTRY_DSN: z.string().url().optional(),
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
  sentry: {
    dsn: parsed.data.SENTRY_DSN,
  },
};
