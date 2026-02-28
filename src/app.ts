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
import { createJobRouter } from "./routes/jobRoutes";
import { createReportRouter } from "./routes/reportRoutes";

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

  // Centralized error handler for async route failures.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Log the error for server-side diagnostics.
    console.error(err);

    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
