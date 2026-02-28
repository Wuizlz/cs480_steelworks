/**
 * Shared TypeScript types for report payloads.
 *
 * These types are used by services and routes to keep
 * response shapes consistent.
 */

/**
 * Weekly summary row returned by the report.
 */
export interface WeeklySummaryRow {
  week_start_date: string;
  production_line: string;
  defect_type: string;
  total_defects: number;
}

/**
 * Underlying record for auditability (AC11).
 */
export interface WeeklyDetailRow {
  week_start_date: string;
  event_source: "PRODUCTION" | "SHIPPING";
  event_date: string;
  line_name: string;
  defect_type: string;
  qty_impacted: number;
  lot_id_norm: string;
  production_log_key: number | null;
  shipping_log_key: number | null;
  shift: string | null;
  downtime_minutes: number | null;
  primary_issue: string | null;
  supervisor_notes: string | null;
  ship_status: string | null;
  hold_reason: string | null;
  qty_shipped: number | null;
  shipping_notes: string | null;
}

/**
 * Flag count row for excluded records (AC12).
 */
export interface FlagCountRow {
  week_start_date: string;
  flag_type: "UNMATCHED_LOT_ID" | "CONFLICT" | "INCOMPLETE_DATA";
  flagged_count: number;
}

/**
 * Result summary for the ingestion/DQ processing job.
 */
export interface ProcessResult {
  processed: number;
  flagged: number;
}
