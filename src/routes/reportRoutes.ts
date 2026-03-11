/**
 * Express routes for reporting endpoints.
 *
 * This module wires HTTP queries to the reporting service layer.
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import {
  getFlagCounts,
  getWeeklyDetails,
  getWeeklySummary,
} from "../services/reportService";
import { asyncHandler } from "../utils/asyncHandler";
import { defaultWeekRangeUTC, parseIsoDateUTC } from "../utils/date";

/**
 * Build a router with report endpoints bound to a database pool.
 *
 * Time complexity: O(1) because it creates router handlers.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
export function createReportRouter(pool: Pool): Router {
  // Create a new router instance for report endpoints.
  const router = Router();

  // Weekly summary endpoint: /reports/weekly-summary
  router.get(
    "/weekly-summary",
    asyncHandler(async (req: Request, res: Response) => {
      // Extract optional week range parameters.
      const startWeek =
        typeof req.query.start_week === "string" ? req.query.start_week : null;
      const endWeek =
        typeof req.query.end_week === "string" ? req.query.end_week : null;

      // Use a default 4-week range if parameters are missing.
      const defaultRange = defaultWeekRangeUTC(4);
      const rangeStart = startWeek ?? defaultRange.start;
      const rangeEnd = endWeek ?? defaultRange.end;

      // Validate date formats before hitting the database.
      if (!parseIsoDateUTC(rangeStart) || !parseIsoDateUTC(rangeEnd)) {
        res
          .status(400)
          .json({ error: "start_week and end_week must be YYYY-MM-DD" });
        return;
      }

      // Query the database for the weekly summary.
      const summary = await getWeeklySummary(pool, rangeStart, rangeEnd);

      res.json({
        start_week: rangeStart,
        end_week: rangeEnd,
        rows: summary,
      });
    }),
  );

  // Weekly detail endpoint: /reports/weekly-details
  router.get(
    "/weekly-details",
    asyncHandler(async (req: Request, res: Response) => {
      // Extract required filters from the query string.
      const weekStart =
        typeof req.query.week_start === "string" ? req.query.week_start : null;
      const lineName =
        typeof req.query.line_name === "string" ? req.query.line_name : null;
      const defectType =
        typeof req.query.defect_type === "string"
          ? req.query.defect_type
          : null;

      // Validate required params.
      if (!weekStart || !lineName || !defectType) {
        res.status(400).json({
          error: "week_start, line_name, and defect_type are required",
        });
        return;
      }

      if (!parseIsoDateUTC(weekStart)) {
        res.status(400).json({ error: "week_start must be YYYY-MM-DD" });
        return;
      }

      // Query the database for underlying detail records.
      const details = await getWeeklyDetails(
        pool,
        weekStart,
        lineName,
        defectType,
      );

      res.json({
        week_start: weekStart,
        line_name: lineName,
        defect_type: defectType,
        rows: details,
      });
    }),
  );

  // Flag counts endpoint: /reports/flags
  router.get(
    "/flags",
    asyncHandler(async (req: Request, res: Response) => {
      // Extract optional week range parameters.
      const startWeek =
        typeof req.query.start_week === "string" ? req.query.start_week : null;
      const endWeek =
        typeof req.query.end_week === "string" ? req.query.end_week : null;

      // Use a default 4-week range if parameters are missing.
      const defaultRange = defaultWeekRangeUTC(4);
      const rangeStart = startWeek ?? defaultRange.start;
      const rangeEnd = endWeek ?? defaultRange.end;

      // Validate date formats before hitting the database.
      if (!parseIsoDateUTC(rangeStart) || !parseIsoDateUTC(rangeEnd)) {
        res
          .status(400)
          .json({ error: "start_week and end_week must be YYYY-MM-DD" });
        return;
      }

      // Query the database for flag counts.
      const flags = await getFlagCounts(pool, rangeStart, rangeEnd);

      res.json({
        start_week: rangeStart,
        end_week: rangeEnd,
        rows: flags,
      });
    }),
  );

  return router;
}
