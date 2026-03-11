/**
 * Express application factory.
 *
 * The app is created with explicit dependencies to enable testing
 * with alternate database pools (e.g., pg-mem).
 */

import express, { Application, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { Sentry } from "./sentry";
import { config } from "./config";
import { getLogger, toErrorMeta } from "./logging/logger";
import { createJobRouter } from "./routes/jobRoutes";
import { createReportRouter } from "./routes/reportRoutes";

const appLogger = getLogger("app");
const httpLogger = getLogger("http");

/**
 * Build the Express application using the provided database pool.
 *
 * Time complexity: O(1) because it only wires middleware and routes.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
export function createApp(pool: Pool): Application {
  // Initialize the Express app instance.
  const app = express();

  // Parse JSON request bodies for POST endpoints.
  app.use(express.json({ limit: "1mb" }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const pathName = req.originalUrl || req.url;
      const meta = {
        method: req.method,
        path: pathName,
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(1)),
      };

      if (pathName === "/health" && res.statusCode < 400) {
        httpLogger.debug("HTTP request completed", meta);
        return;
      }

      if (res.statusCode >= 500) {
        httpLogger.error("HTTP request completed", meta);
        return;
      }

      if (res.statusCode >= 400) {
        httpLogger.warn("HTTP request completed", meta);
        return;
      }

      httpLogger.info("HTTP request completed", meta);
    });

    next();
  });

  // Basic health check to confirm the service is running.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Mount report endpoints under /reports.
  app.use("/reports", createReportRouter(pool));

  // Mount job endpoints under /jobs.
  app.use("/jobs", createJobRouter(pool));

  // Serve the React build if it exists (production mode).
  const uiDistPath = path.join(process.cwd(), "frontend", "dist");

  if (fs.existsSync(uiDistPath)) {
    // Serve static frontend assets from the Vite build output.
    app.use(express.static(uiDistPath));
  }

  if (config.sentry.dsn) {
    // Sentry recommends adding this after routes and before custom error handlers.
    Sentry.setupExpressErrorHandler(app);
  }

  // Centralized error handler for async route failures.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Log the error for server-side diagnostics.
    appLogger.error("Unhandled request error", {
      method: req.method,
      path: req.originalUrl || req.url,
      ...toErrorMeta(err),
    });

    res.status(500).json({ error: "Internal server error" });
  });

  appLogger.info("Express application created", {
    serves_frontend: fs.existsSync(uiDistPath),
    sentry_enabled: Boolean(config.sentry.dsn),
  });

  return app;
}
