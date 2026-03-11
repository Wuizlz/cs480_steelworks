/**
 * Express routes for maintenance jobs (data quality processing).
 *
 * These routes allow manual triggering of the log processing pipeline.
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { getLogger } from "../logging/logger";
import { processAllLogs } from "../services/ingestService";
import { asyncHandler } from "../utils/asyncHandler";

const logger = getLogger("routes.job");

/**
 * Build a router with job endpoints bound to a database pool.
 *
 * Time complexity: O(1) because it creates router handlers.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
export function createJobRouter(pool: Pool): Router {
  const router = Router();

  // Trigger data quality processing for both production and shipping logs.
  router.post(
    "/process-logs",
    asyncHandler(async (req: Request, res: Response) => {
      // Allow an optional batch_size to bound per-call work.
      const rawBatch = req.body?.batch_size;
      if (
        rawBatch !== undefined &&
        (typeof rawBatch !== "number" || rawBatch <= 0)
      ) {
        logger.warn("Invalid batch_size supplied to process-logs endpoint", {
          batch_size: rawBatch,
        });
      }

      const batchSize =
        typeof rawBatch === "number" && rawBatch > 0 ? rawBatch : undefined;

      logger.info("Processing logs requested", {
        batch_size: batchSize ?? "default",
      });

      const result = await processAllLogs(pool, batchSize);

      res.json({
        batch_size: batchSize ?? undefined,
        production: result.production,
        shipping: result.shipping,
      });
    }),
  );

  return router;
}
