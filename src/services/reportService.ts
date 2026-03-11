/**
 * Reporting services for weekly summaries and audit details.
 *
 * These functions are thin wrappers around SQL queries to keep
 * reporting logic centralized and testable.
 */

import { Pool } from "pg";
import {
  FLAG_COUNTS_SQL,
  WEEKLY_DETAILS_SQL,
  WEEKLY_SUMMARY_SQL,
} from "../db/queries";
import { getLogger, toErrorMeta } from "../logging/logger";
import { FlagCountRow, WeeklyDetailRow, WeeklySummaryRow } from "../types";

const logger = getLogger("service.report");
const LARGE_RESULT_THRESHOLD = 1000;

/**
 * Fetch the weekly summary grouped by production line and defect type.
 *
 * Time complexity: O(n) in the number of issue events scanned by Postgres.
 * Space complexity: O(k) for the number of grouped rows returned.
 */
export async function getWeeklySummary(
  pool: Pool,
  startWeek: string,
  endWeek: string,
): Promise<WeeklySummaryRow[]> {
  logger.info("Running weekly summary query", {
    start_week: startWeek,
    end_week: endWeek,
  });

  try {
    // Run the parameterized SQL query against the database.
    const result = await pool.query(WEEKLY_SUMMARY_SQL, [startWeek, endWeek]);

    if (result.rows.length > LARGE_RESULT_THRESHOLD) {
      logger.warn("Weekly summary query returned a large result set", {
        start_week: startWeek,
        end_week: endWeek,
        row_count: result.rows.length,
      });
    }

    logger.info("Weekly summary query completed", {
      start_week: startWeek,
      end_week: endWeek,
      row_count: result.rows.length,
    });

    // The pg driver returns dates as strings; cast to the expected type.
    return result.rows.map((row) => ({
      week_start_date:
        row.week_start_date instanceof Date
          ? row.week_start_date.toISOString().slice(0, 10)
          : row.week_start_date,
      production_line: row.production_line,
      defect_type: row.defect_type,
      total_defects: Number(row.total_defects),
    }));
  } catch (error) {
    logger.error("Weekly summary query failed", {
      start_week: startWeek,
      end_week: endWeek,
      ...toErrorMeta(error),
    });
    throw error;
  }
}

/**
 * Fetch the underlying records for a single weekly summary cell.
 *
 * Time complexity: O(n) in the number of matching issue events.
 * Space complexity: O(n) for the returned detail rows.
 */
export async function getWeeklyDetails(
  pool: Pool,
  weekStart: string,
  productionLine: string,
  defectType: string,
): Promise<WeeklyDetailRow[]> {
  logger.info("Running weekly details query", {
    week_start: weekStart,
    production_line: productionLine,
    defect_type: defectType,
  });

  try {
    // Execute the detail query using the provided filter values.
    const result = await pool.query(WEEKLY_DETAILS_SQL, [
      weekStart,
      productionLine,
      defectType,
    ]);

    if (result.rows.length > LARGE_RESULT_THRESHOLD) {
      logger.warn("Weekly details query returned a large result set", {
        week_start: weekStart,
        production_line: productionLine,
        defect_type: defectType,
        row_count: result.rows.length,
      });
    }

    logger.info("Weekly details query completed", {
      week_start: weekStart,
      production_line: productionLine,
      defect_type: defectType,
      row_count: result.rows.length,
    });

    // Map result rows into strongly typed objects.
    return result.rows.map((row) => ({
      week_start_date: row.week_start_date,
      event_source: row.event_source,
      event_date: row.event_date,
      line_name: row.line_name,
      defect_type: row.defect_type,
      qty_impacted: Number(row.qty_impacted),
      lot_id_norm: row.lot_id_norm,
      production_log_key: row.production_log_key,
      shipping_log_key: row.shipping_log_key,
      shift: row.shift,
      downtime_minutes: row.downtime_minutes,
      primary_issue: row.primary_issue,
      supervisor_notes: row.supervisor_notes,
      ship_status: row.ship_status,
      hold_reason: row.hold_reason,
      qty_shipped: row.qty_shipped,
      shipping_notes: row.shipping_notes,
    }));
  } catch (error) {
    logger.error("Weekly details query failed", {
      week_start: weekStart,
      production_line: productionLine,
      defect_type: defectType,
      ...toErrorMeta(error),
    });
    throw error;
  }
}

/**
 * Fetch counts of excluded/flagged records by week and reason.
 *
 * Time complexity: O(n) in the number of data_quality_flag rows scanned.
 * Space complexity: O(k) for the grouped rows returned.
 */
export async function getFlagCounts(
  pool: Pool,
  startWeek: string,
  endWeek: string,
): Promise<FlagCountRow[]> {
  logger.info("Running flag counts query", {
    start_week: startWeek,
    end_week: endWeek,
  });

  try {
    // Execute the aggregate query for data quality flags.
    const result = await pool.query(FLAG_COUNTS_SQL, [startWeek, endWeek]);

    logger.info("Flag counts query completed", {
      start_week: startWeek,
      end_week: endWeek,
      row_count: result.rows.length,
    });

    // Normalize count values into numbers for API responses.
    return result.rows.map((row) => ({
      week_start_date:
        row.week_start_date instanceof Date
          ? row.week_start_date.toISOString().slice(0, 10)
          : row.week_start_date,
      flag_type: row.flag_type,
      flagged_count: Number(row.flagged_count),
    }));
  } catch (error) {
    logger.error("Flag counts query failed", {
      start_week: startWeek,
      end_week: endWeek,
      ...toErrorMeta(error),
    });
    throw error;
  }
}
