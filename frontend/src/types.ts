/**
 * Shared TypeScript types for the frontend UI.
 *
 * These mirror the API response shapes used by the backend.
 */

/**
 * Weekly summary row returned by /reports/weekly-summary.
 */
export interface WeeklySummaryRow {
  week_start_date: string;
  production_line: string;
  defect_type: string;
  total_defects: number;
}

/**
 * Detail row returned by /reports/weekly-details.
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
 * Flag count row returned by /reports/flags.
 */
export interface FlagCountRow {
  week_start_date: string;
  flag_type: "UNMATCHED_LOT_ID" | "CONFLICT" | "INCOMPLETE_DATA";
  flagged_count: number;
}

/**
 * Response wrapper for weekly summary endpoint.
 */
export interface WeeklySummaryResponse {
  start_week: string;
  end_week: string;
  rows: WeeklySummaryRow[];
}

/**
 * Response wrapper for weekly detail endpoint.
 */
export interface WeeklyDetailResponse {
  week_start: string;
  line_name: string;
  defect_type: string;
  rows: WeeklyDetailRow[];
}

/**
 * Response wrapper for flag counts endpoint.
 */
export interface FlagCountResponse {
  start_week: string;
  end_week: string;
  rows: FlagCountRow[];
}

/**
 * Response wrapper for processing job endpoint.
 */
export interface ProcessLogsResponse {
  production: { processed: number; flagged: number };
  shipping: { processed: number; flagged: number };
}
