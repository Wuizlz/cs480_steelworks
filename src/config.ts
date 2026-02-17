/**
 * Application configuration and environment validation.
 *
 * This module centralizes env parsing so runtime failures are clear
 * and consistent across the codebase.
 */

import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env into process.env.
dotenv.config();

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
  PORT: z.coerce.number().int().positive().optional().default(3000)
});

// Parse and validate environment variables once at startup.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable error if env vars are missing or invalid.
  // This prevents hard-to-debug connection errors later.
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
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
      rejectUnauthorized: parsed.data.PGSSLREJECTUNAUTHORIZED === "true"
    }
  },
  port: parsed.data.PORT
};
