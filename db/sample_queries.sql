SELECT
  ie.week_start_date AS week,
  pl.line_name       AS production_line,
  it.issue_label     AS defect_type,
  SUM(ie.qty_impacted) AS total_defects
FROM ops.fact_issue_event ie
JOIN ops.dim_production_line pl ON pl.production_line_key = ie.production_line_key
JOIN ops.dim_issue_type it ON it.issue_type_key = ie.issue_type_key
WHERE ie.qty_impacted > 0                               -- AC7
GROUP BY 1,2,3
ORDER BY 1 DESC, 2, 4 DESC;


-- Params:
--   :start_week (date) e.g. '2026-01-19'
--   :end_week   (date) e.g. '2026-02-09'

SELECT
  ie.week_start_date,
  pl.line_name,
  it.issue_label AS defect_type,
  SUM(ie.qty_impacted) AS total_defects
FROM ops.fact_issue_event ie
JOIN ops.dim_production_line pl ON pl.production_line_key = ie.production_line_key
JOIN ops.dim_issue_type it      ON it.issue_type_key      = ie.issue_type_key
WHERE ie.week_start_date BETWEEN :start_week AND :end_week
  AND ie.qty_impacted > 0           -- AC7: exclude zeros from totals
ORDER BY
  ie.week_start_date,
  pl.line_name,
  defect_type;


SELECT
  ie.week_start_date,
  pl.line_name,
  it.issue_label AS defect_type,
  SUM(ie.qty_impacted) AS total_defects
FROM ops.fact_issue_event ie
JOIN ops.dim_production_line pl ON pl.production_line_key = ie.production_line_key
JOIN ops.dim_issue_type it      ON it.issue_type_key      = ie.issue_type_key
WHERE ie.week_start_date BETWEEN :start_week AND :end_week
  AND ie.qty_impacted > 0
GROUP BY ie.week_start_date, pl.line_name, it.issue_label
ORDER BY ie.week_start_date DESC, total_defects DESC;


-- Params:
--   :week_start (date)
--   :line_name  (text)
--   :defect_label (text)

SELECT
  ie.week_start_date,
  ie.event_source,
  ie.event_date,
  pl.line_name,
  it.issue_label AS defect_type,
  ie.qty_impacted,
  l.lot_id_norm,

  -- traceability to raw source rows
  ie.production_log_key,
  ie.shipping_log_key,

  -- optional source context
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
WHERE ie.week_start_date = :week_start
  AND pl.line_name = :line_name
  AND it.issue_label = :defect_label
ORDER BY ie.event_date, l.lot_id_norm;


WITH dq AS (
  SELECT
    dqf.data_quality_flag_key,
    dqf.flag_type,
    dqf.source,
    COALESCE(p.run_date, s.ship_date)::date AS flag_date
  FROM ops.data_quality_flag dqf
  LEFT JOIN ops.fact_production_log p ON p.production_log_key = dqf.production_log_key
  LEFT JOIN ops.fact_shipping_log   s ON s.shipping_log_key   = dqf.shipping_log_key
  WHERE dqf.flag_type IN ('UNMATCHED_LOT_ID','INVALID_LOT_ID','CONFLICT','INCOMPLETE_DATA')
)
SELECT
  date_trunc('week', dq.flag_date)::date AS week_start_date,
  dq.flag_type,
  COUNT(*) AS flagged_count
FROM dq
WHERE dq.flag_date IS NOT NULL
  AND date_trunc('week', dq.flag_date)::date BETWEEN :start_week AND :end_week
GROUP BY 1, 2
ORDER BY 1, 2;


SELECT
  dqf.flag_type,
  dqf.lot_id_raw,
  dqf.lot_id_norm,
  COUNT(*) AS occurrences,
  MIN(dqf.created_at) AS first_seen,
  MAX(dqf.created_at) AS last_seen
FROM ops.data_quality_flag dqf
WHERE dqf.flag_type IN ('UNMATCHED_LOT_ID','INVALID_LOT_ID')
GROUP BY dqf.flag_type, dqf.lot_id_raw, dqf.lot_id_norm
ORDER BY occurrences DESC, last_seen DESC;


SELECT
  lot_key,
  COUNT(DISTINCT production_line_key) AS distinct_lines,
  ARRAY_AGG(DISTINCT production_line_key ORDER BY production_line_key) AS line_keys
FROM ops.fact_production_log
WHERE lot_key IS NOT NULL
GROUP BY lot_key
HAVING COUNT(DISTINCT production_line_key) > 1
ORDER BY distinct_lines DESC;


EXPLAIN (ANALYZE, BUFFERS)
SELECT
  ie.week_start_date,
  ie.production_line_key,
  ie.issue_type_key,
  SUM(ie.qty_impacted)
FROM ops.fact_issue_event ie
WHERE ie.week_start_date BETWEEN :start_week AND :end_week
  AND ie.qty_impacted > 0
GROUP BY 1,2,3;
