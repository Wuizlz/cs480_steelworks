/**
 * Parameterized SQL queries used by services.
 *
 * Keeping queries in one place makes it easier to audit data access
 * and review changes against the db/schema.sql source of truth.
 */

// Weekly summary grouped by production line and defect type.
export const WEEKLY_SUMMARY_SQL = `
  SELECT
    ie.week_start_date::date AS week_start_date,
    pl.line_name             AS production_line,
    it.issue_label           AS defect_type,
    SUM(ie.qty_impacted)     AS total_defects
  FROM ops.fact_issue_event ie
  JOIN ops.dim_production_line pl ON pl.production_line_key = ie.production_line_key
  JOIN ops.dim_issue_type it      ON it.issue_type_key      = ie.issue_type_key
  WHERE ie.week_start_date BETWEEN $1 AND $2
    AND ie.qty_impacted > 0
  GROUP BY
    ie.week_start_date::date,
    pl.line_name,
    it.issue_label
  ORDER BY
    ie.week_start_date::date ASC,
    pl.line_name ASC,
    SUM(ie.qty_impacted) DESC;
`;

// Underlying records for a specific weekly summary cell (AC11).
export const WEEKLY_DETAILS_SQL = `
  SELECT
    ie.week_start_date,
    ie.event_source,
    ie.event_date,
    pl.line_name,
    it.issue_label AS defect_type,
    ie.qty_impacted,
    l.lot_id_norm,
    ie.production_log_key,
    ie.shipping_log_key,
    p.shift,
    p.downtime_minutes,
    p.primary_issue,
    p.supervisor_notes,
    s.ship_status,
    s.hold_reason,
    s.qty_shipped,
    s.shipping_notes
  FROM ops.fact_issue_event ie
  JOIN ops.dim_production_line pl ON pl.production_line_key = ie.production_line_key
  JOIN ops.dim_issue_type it      ON it.issue_type_key      = ie.issue_type_key
  JOIN ops.dim_lot l              ON l.lot_key              = ie.lot_key
  LEFT JOIN ops.fact_production_log p ON p.production_log_key = ie.production_log_key
  LEFT JOIN ops.fact_shipping_log   s ON s.shipping_log_key   = ie.shipping_log_key
  WHERE ie.week_start_date = $1
    AND pl.line_name = $2
    AND it.issue_label = $3
  ORDER BY ie.event_date, l.lot_id_norm;
`;

// Counts of excluded/flagged records by reason (AC12).
export const FLAG_COUNTS_SQL = `
  WITH dq AS (
    SELECT
      dqf.flag_type,
      COALESCE(p.run_date, s.ship_date)::date AS flag_date
    FROM ops.data_quality_flag dqf
    LEFT JOIN ops.fact_production_log p ON p.production_log_key = dqf.production_log_key
    LEFT JOIN ops.fact_shipping_log   s ON s.shipping_log_key   = dqf.shipping_log_key
    WHERE dqf.flag_type IN ('UNMATCHED_LOT_ID', 'CONFLICT', 'INCOMPLETE_DATA')
  )
  SELECT
    date_trunc('week', dq.flag_date)::date AS week_start_date,
    dq.flag_type,
    COUNT(*) AS flagged_count
  FROM dq
  WHERE dq.flag_date IS NOT NULL
    AND date_trunc('week', dq.flag_date)::date BETWEEN $1 AND $2
  GROUP BY
    date_trunc('week', dq.flag_date)::date,
    dq.flag_type
  ORDER BY
    date_trunc('week', dq.flag_date)::date,
    dq.flag_type;
`;

// Normalize a raw lot id into a canonical representation (AC9 + AC4).
export const NORMALIZE_LOT_ID_SQL = `SELECT ops.normalize_lot_id($1) AS lot_id_norm;`;

// Normalize labels (production line names, issue labels) consistently (AC9).
export const NORMALIZE_LABEL_SQL = `SELECT ops.normalize_label($1) AS label_norm;`;

// Upsert production line by normalized name, returning its key.
export const UPSERT_PRODUCTION_LINE_SQL = `
  INSERT INTO ops.dim_production_line (line_name, line_name_norm)
  VALUES ($1, $2)
  ON CONFLICT (line_name_norm)
  DO UPDATE SET line_name = ops.dim_production_line.line_name
  RETURNING production_line_key;
`;

// Upsert issue type by normalized label and source, returning its key.
export const UPSERT_ISSUE_TYPE_SQL = `
  INSERT INTO ops.dim_issue_type (source, issue_label, issue_label_norm)
  VALUES ($1, $2, $3)
  ON CONFLICT (source, issue_label_norm)
  DO UPDATE SET issue_label = ops.dim_issue_type.issue_label
  RETURNING issue_type_key;
`;

// Fetch an existing lot by normalized lot id.
export const FIND_LOT_SQL = `
  SELECT lot_key, lot_id_norm
  FROM ops.dim_lot
  WHERE lot_id_norm = $1;
`;

// Fetch a lot by surrogate key for traceability lookups.
export const FIND_LOT_BY_KEY_SQL = `
  SELECT lot_key, lot_id_norm
  FROM ops.dim_lot
  WHERE lot_key = $1;
`;

// Update a production log row with a resolved lot key for traceability.
export const UPDATE_PROD_LOG_LOT_SQL = `
  UPDATE ops.fact_production_log
  SET lot_key = $1
  WHERE production_log_key = $2;
`;

// Update a shipping log row with a resolved lot key for traceability.
export const UPDATE_SHIP_LOG_LOT_SQL = `
  UPDATE ops.fact_shipping_log
  SET lot_key = $1
  WHERE shipping_log_key = $2;
`;

// Insert a data quality flag for an excluded record (AC5, AC6, AC8).
export const INSERT_DQ_FLAG_SQL = `
  INSERT INTO ops.data_quality_flag (
    flag_type,
    source,
    flag_reason,
    missing_fields,
    lot_id_raw,
    lot_id_norm,
    production_log_key,
    shipping_log_key,
    issue_event_key
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
`;

// Lookup existing line assignment for a lot (AC6).
export const FIND_LOT_ASSIGNMENT_SQL = `
  SELECT production_line_key
  FROM ops.lot_line_assignment
  WHERE lot_key = $1;
`;

// Assign a lot to a production line (first assignment wins).
export const INSERT_LOT_ASSIGNMENT_SQL = `
  INSERT INTO ops.lot_line_assignment (lot_key, production_line_key)
  VALUES ($1, $2);
`;

// Insert a normalized issue event for reporting (AC1-AC4).
export const INSERT_ISSUE_EVENT_SQL = `
  INSERT INTO ops.fact_issue_event (
    event_source,
    event_date,
    week_start_date,
    production_line_key,
    lot_key,
    issue_type_key,
    qty_impacted,
    production_log_key,
    shipping_log_key
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
`;

// Select unprocessed production logs (no issue event yet).
export const UNPROCESSED_PRODUCTION_LOGS_SQL = `
  SELECT p.*
  FROM ops.fact_production_log p
  LEFT JOIN ops.fact_issue_event ie ON ie.production_log_key = p.production_log_key
  WHERE ie.production_log_key IS NULL
  ORDER BY p.production_log_key
  LIMIT $1;
`;

// Select unprocessed shipping logs (no issue event yet).
export const UNPROCESSED_SHIPPING_LOGS_SQL = `
  SELECT s.*
  FROM ops.fact_shipping_log s
  LEFT JOIN ops.fact_issue_event ie ON ie.shipping_log_key = s.shipping_log_key
  WHERE ie.shipping_log_key IS NULL
  ORDER BY s.shipping_log_key
  LIMIT $1;
`;
