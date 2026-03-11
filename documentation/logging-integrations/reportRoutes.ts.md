# Understanding `src/routes/reportRoutes.ts`

This document explains how [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) logs invalid reporting requests before they reach the service layer.

This file is a validation-and-routing layer for report endpoints.

## Why This File Matters for Logging

This route module logs warnings when incoming requests are malformed, such as:

- invalid date ranges
- missing required filters
- invalid `week_start` values

It does not log query success or database failure directly. That happens later in
[src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts).

So this file's logging role is:

- catch bad input early
- explain rejected requests

## Full Code

```ts
/**
 * Express routes for reporting endpoints.
 *
 * This module wires HTTP queries to the reporting service layer.
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { getLogger } from "../logging/logger";
import {
  getFlagCounts,
  getWeeklyDetails,
  getWeeklySummary,
} from "../services/reportService";
import { asyncHandler } from "../utils/asyncHandler";
import { defaultWeekRangeUTC, parseIsoDateUTC } from "../utils/date";

const logger = getLogger("routes.report");

export function createReportRouter(pool: Pool): Router {
  const router = Router();

  router.get(
    "/weekly-summary",
    asyncHandler(async (req: Request, res: Response) => {
      const startWeek =
        typeof req.query.start_week === "string" ? req.query.start_week : null;
      const endWeek =
        typeof req.query.end_week === "string" ? req.query.end_week : null;

      const defaultRange = defaultWeekRangeUTC(4);
      const rangeStart = startWeek ?? defaultRange.start;
      const rangeEnd = endWeek ?? defaultRange.end;

      if (!parseIsoDateUTC(rangeStart) || !parseIsoDateUTC(rangeEnd)) {
        logger.warn("Rejected weekly summary request with invalid date range", {
          start_week: rangeStart,
          end_week: rangeEnd,
        });
        res
          .status(400)
          .json({ error: "start_week and end_week must be YYYY-MM-DD" });
        return;
      }

      const summary = await getWeeklySummary(pool, rangeStart, rangeEnd);

      res.json({
        start_week: rangeStart,
        end_week: rangeEnd,
        rows: summary,
      });
    }),
  );

  router.get(
    "/weekly-details",
    asyncHandler(async (req: Request, res: Response) => {
      const weekStart =
        typeof req.query.week_start === "string" ? req.query.week_start : null;
      const lineName =
        typeof req.query.line_name === "string" ? req.query.line_name : null;
      const defectType =
        typeof req.query.defect_type === "string"
          ? req.query.defect_type
          : null;

      if (!weekStart || !lineName || !defectType) {
        logger.warn("Rejected weekly details request with missing filters", {
          week_start: weekStart,
          line_name: lineName,
          defect_type: defectType,
        });
        res.status(400).json({
          error: "week_start, line_name, and defect_type are required",
        });
        return;
      }

      if (!parseIsoDateUTC(weekStart)) {
        logger.warn("Rejected weekly details request with invalid week_start", {
          week_start: weekStart,
        });
        res.status(400).json({ error: "week_start must be YYYY-MM-DD" });
        return;
      }

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

  router.get(
    "/flags",
    asyncHandler(async (req: Request, res: Response) => {
      const startWeek =
        typeof req.query.start_week === "string" ? req.query.start_week : null;
      const endWeek =
        typeof req.query.end_week === "string" ? req.query.end_week : null;

      const defaultRange = defaultWeekRangeUTC(4);
      const rangeStart = startWeek ?? defaultRange.start;
      const rangeEnd = endWeek ?? defaultRange.end;

      if (!parseIsoDateUTC(rangeStart) || !parseIsoDateUTC(rangeEnd)) {
        logger.warn("Rejected flag counts request with invalid date range", {
          start_week: rangeStart,
          end_week: rangeEnd,
        });
        res
          .status(400)
          .json({ error: "start_week and end_week must be YYYY-MM-DD" });
        return;
      }

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
```

## Section 1: Module Logger

```ts
const logger = getLogger("routes.report");
```

This groups validation-related route logs under `routes.report`.

That keeps them distinct from:

- `http` request completion logs
- `service.report` query execution logs

## Section 2: Why These Are Warnings

Every logging call in this route file uses `logger.warn(...)`.

That is appropriate because:

- the server is still working
- the request was rejected for a reason
- the situation is unusual enough to record

These are not `error` logs because the system itself did not fail.
The client simply made a request that did not pass validation.

## Section 3: Weekly Summary Validation Log

```ts
logger.warn("Rejected weekly summary request with invalid date range", {
  start_week: rangeStart,
  end_week: rangeEnd,
});
```

This captures the invalid range values before the request is rejected with `400`.

Why this is helpful:

- explains why the route returned a validation error
- preserves the actual bad values used in the request

## Section 4: Weekly Details Validation Logs

The details endpoint logs two different validation failures.

### Missing required filters

```ts
logger.warn("Rejected weekly details request with missing filters", {
  week_start: weekStart,
  line_name: lineName,
  defect_type: defectType,
});
```

This records incomplete requests.

### Invalid date format

```ts
logger.warn("Rejected weekly details request with invalid week_start", {
  week_start: weekStart,
});
```

This records a malformed date value even when other parameters are present.

That separation is useful because the cause of rejection is not the same.

## Section 5: Flag Counts Validation Log

```ts
logger.warn("Rejected flag counts request with invalid date range", {
  start_week: rangeStart,
  end_week: rangeEnd,
});
```

This is the same idea as weekly summary validation, but for the flag-report endpoint.

The route logs the bad input and rejects the request before touching the database.

## Section 6: Relationship to `reportService.ts`

This file stops bad requests early.

That means:

- route file logs validation problems
- service file logs actual query execution

This is a clean separation of concerns.

It prevents query-level logs from being polluted by requests that never should
have reached the database in the first place.

## Final Mental Model

You can think of `src/routes/reportRoutes.ts` as the filter layer for reporting logs.

It tells you:

- when requests were rejected
- why they were rejected
- what bad values caused the rejection

Then `src/services/reportService.ts` takes over for valid requests.
