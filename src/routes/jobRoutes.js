"use strict";
/**
 * Express routes for maintenance jobs (data quality processing).
 *
 * These routes allow manual triggering of the log processing pipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJobRouter = createJobRouter;
const express_1 = require("express");
const logger_1 = require("../logging/logger");
const ingestService_1 = require("../services/ingestService");
const asyncHandler_1 = require("../utils/asyncHandler");
const logger = (0, logger_1.getLogger)("routes.job");
/**
 * Build a router with job endpoints bound to a database pool.
 *
 * Time complexity: O(1) because it creates router handlers.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
function createJobRouter(pool) {
  const router = (0, express_1.Router)();
  // Trigger data quality processing for both production and shipping logs.
  router.post(
    "/process-logs",
    (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
      const result = await (0, ingestService_1.processAllLogs)(pool, batchSize);
      res.json({
        batch_size: batchSize ?? undefined,
        production: result.production,
        shipping: result.shipping,
      });
    }),
  );
  return router;
}
