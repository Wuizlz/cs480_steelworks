// File: src/ops-weekly-summary/types.ts

export type ISODateString = string;

// Week boundaries are represented as ISO dates (YYYY-MM-DD) for consistency (AC10).
export interface WeekRange {
  startWeek: ISODateString;
  endWeek: ISODateString;
}

export type IssueSource = "PRODUCTION" | "SHIPPING";

export type ExclusionReason =
  | "UNMATCHED_LOT_ID"
  | "INVALID_LOT_ID"
  | "CONFLICT"
  | "INCOMPLETE_DATA";

// Weekly summary output (AC1–AC3, AC9–AC10)
export interface WeeklySummaryRow {
  weekStartDate: ISODateString;
  productionLine: string;
  defectType: string;
  totalDefects: number;
}

// Excluded/flagged counts by reason (AC12)
export interface ExcludedCountRow {
  weekStartDate: ISODateString;
  reason: ExclusionReason;
  count: number;
}

// Drill-down filter for auditability (AC11)
export interface UnderlyingRecordsQuery {
  weekStartDate: ISODateString;
  productionLine: string;
  defectType: string;
}

// Underlying records that contributed to a weekly total (AC11)
export interface UnderlyingRecord {
  weekStartDate: ISODateString;
  eventDate: ISODateString;
  eventSource: IssueSource;
  productionLine: string;
  defectType: string;
  qtyDefects: number;
  lotId: string;

  // Traceability to source rows (schema: ops.fact_issue_event)
  issueEventKey?: number | null;
  productionLogKey?: number | null;
  shippingLogKey?: number | null;
}

export interface WeeklyIssueSummaryReport {
  range: WeekRange;
  rows: WeeklySummaryRow[];
  excludedCounts: ExcludedCountRow[];
}
