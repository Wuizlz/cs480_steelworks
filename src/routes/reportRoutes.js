"use strict";
/**
 * Express routes for reporting endpoints.
 *
 * This module wires HTTP queries to the reporting service layer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportRouter = createReportRouter;
const express_1 = require("express");
const logger_1 = require("../logging/logger");
const reportService_1 = require("../services/reportService");
const asyncHandler_1 = require("../utils/asyncHandler");
const date_1 = require("../utils/date");
const logger = (0, logger_1.getLogger)("routes.report");
/**
 * Build a router with report endpoints bound to a database pool.
 *
 * Time complexity: O(1) because it creates router handlers.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
function createReportRouter(pool) {
    // Create a new router instance for report endpoints.
    const router = (0, express_1.Router)();
    // Weekly summary endpoint: /reports/weekly-summary
    router.get("/weekly-summary", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        // Extract optional week range parameters.
        const startWeek = typeof req.query.start_week === "string" ? req.query.start_week : null;
        const endWeek = typeof req.query.end_week === "string" ? req.query.end_week : null;
        // Use a default 4-week range if parameters are missing.
        const defaultRange = (0, date_1.defaultWeekRangeUTC)(4);
        const rangeStart = startWeek ?? defaultRange.start;
        const rangeEnd = endWeek ?? defaultRange.end;
        // Validate date formats before hitting the database.
        if (!(0, date_1.parseIsoDateUTC)(rangeStart) || !(0, date_1.parseIsoDateUTC)(rangeEnd)) {
            logger.warn("Rejected weekly summary request with invalid date range", {
                start_week: rangeStart,
                end_week: rangeEnd,
            });
            res
                .status(400)
                .json({ error: "start_week and end_week must be YYYY-MM-DD" });
            return;
        }
        // Query the database for the weekly summary.
        const summary = await (0, reportService_1.getWeeklySummary)(pool, rangeStart, rangeEnd);
        res.json({
            start_week: rangeStart,
            end_week: rangeEnd,
            rows: summary,
        });
    }));
    // Weekly detail endpoint: /reports/weekly-details
    router.get("/weekly-details", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        // Extract required filters from the query string.
        const weekStart = typeof req.query.week_start === "string" ? req.query.week_start : null;
        const lineName = typeof req.query.line_name === "string" ? req.query.line_name : null;
        const defectType = typeof req.query.defect_type === "string"
            ? req.query.defect_type
            : null;
        // Validate required params.
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
        if (!(0, date_1.parseIsoDateUTC)(weekStart)) {
            logger.warn("Rejected weekly details request with invalid week_start", {
                week_start: weekStart,
            });
            res.status(400).json({ error: "week_start must be YYYY-MM-DD" });
            return;
        }
        // Query the database for underlying detail records.
        const details = await (0, reportService_1.getWeeklyDetails)(pool, weekStart, lineName, defectType);
        res.json({
            week_start: weekStart,
            line_name: lineName,
            defect_type: defectType,
            rows: details,
        });
    }));
    // Flag counts endpoint: /reports/flags
    router.get("/flags", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        // Extract optional week range parameters.
        const startWeek = typeof req.query.start_week === "string" ? req.query.start_week : null;
        const endWeek = typeof req.query.end_week === "string" ? req.query.end_week : null;
        // Use a default 4-week range if parameters are missing.
        const defaultRange = (0, date_1.defaultWeekRangeUTC)(4);
        const rangeStart = startWeek ?? defaultRange.start;
        const rangeEnd = endWeek ?? defaultRange.end;
        // Validate date formats before hitting the database.
        if (!(0, date_1.parseIsoDateUTC)(rangeStart) || !(0, date_1.parseIsoDateUTC)(rangeEnd)) {
            logger.warn("Rejected flag counts request with invalid date range", {
                start_week: rangeStart,
                end_week: rangeEnd,
            });
            res
                .status(400)
                .json({ error: "start_week and end_week must be YYYY-MM-DD" });
            return;
        }
        // Query the database for flag counts.
        const flags = await (0, reportService_1.getFlagCounts)(pool, rangeStart, rangeEnd);
        res.json({
            start_week: rangeStart,
            end_week: rangeEnd,
            rows: flags,
        });
    }));
    return router;
}
