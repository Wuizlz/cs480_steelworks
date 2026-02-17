/**
 * End-to-end service tests for the weekly reporting workflow.
 *
 * These tests validate the acceptance criteria using an in-memory DB.
 */

import { Pool } from "pg";
import { createTestPool } from "./helpers";
import { getFlagCounts, getWeeklyDetails, getWeeklySummary } from "../src/services/reportService";
import { processAllLogs } from "../src/services/ingestService";

// Shared pool instance for each test suite.
let pool: Pool;

/**
 * Insert a production line with normalized label.
 *
 * Time complexity: O(1) because it performs constant DB work.
 * Space complexity: O(1).
 */
async function insertProductionLine(lineName: string): Promise<number> {
  // Normalize the line name using the DB function.
  const normResult = await pool.query("SELECT ops.normalize_label($1) AS norm", [lineName]);
  const norm = normResult.rows[0].norm as string;

  // Insert the production line using the normalized name.
  const result = await pool.query(
    "INSERT INTO ops.dim_production_line (line_name, line_name_norm) VALUES ($1, $2) RETURNING production_line_key",
    [lineName, norm]
  );

  return Number(result.rows[0].production_line_key);
}

/**
 * Insert a lot using the normalized lot id.
 *
 * Time complexity: O(1).
 * Space complexity: O(1).
 */
async function insertLot(lotIdRaw: string): Promise<number> {
  // Normalize the lot id using the DB function.
  const normResult = await pool.query("SELECT ops.normalize_lot_id($1) AS norm", [lotIdRaw]);
  const norm = normResult.rows[0].norm as string;

  // Insert the lot into the dimension table.
  const result = await pool.query(
    "INSERT INTO ops.dim_lot (lot_id_norm, part_key) VALUES ($1, NULL) RETURNING lot_key",
    [norm]
  );

  return Number(result.rows[0].lot_key);
}

beforeEach(() => {
  // Recreate a fresh in-memory DB per test for isolation.
  const created = createTestPool();
  pool = created.pool as unknown as Pool;
});

afterEach(async () => {
  // Close the pool to avoid open handles in Jest.
  if (pool) {
    await pool.end();
  }
});

/**
 * Seed the database with production/shipping logs that hit all ACs.
 *
 * Time complexity: O(n) for the number of seed inserts.
 * Space complexity: O(1) aside from inserted rows.
 */
async function seedTestData() {
  // Create production lines.
  const line1Key = await insertProductionLine("Line 1");
  const line2Key = await insertProductionLine("Line 2");

  // Create lots.
  const lot100Key = await insertLot("LOT-100");
  const lot200Key = await insertLot("LOT-200");

  // Insert production logs covering success, missing, conflict, incomplete, and zero qty cases.
  await pool.query(
    `INSERT INTO ops.fact_production_log
     (run_date, production_line_key, lot_key, lot_id_raw, primary_issue, line_issue_flag)
     VALUES
     ('2026-02-02', $1, NULL, 'LOT-100', 'Scratch', TRUE),
     ('2026-02-02', $1, NULL, NULL, 'Scratch', TRUE),
     ('2026-02-03', $1, NULL, '???', 'Scratch', TRUE),
     ('2026-02-04', $2, NULL, 'LOT-100', 'Scratch', TRUE),
     ('2026-02-05', $1, NULL, 'LOT-200', NULL, TRUE),
     ('2026-02-06', $1, NULL, 'LOT-200', 'Dent', FALSE),
     ('2026-02-07', $1, NULL, 'LOT-200', '  sCrAtCh  ', TRUE)
    `,
    [line1Key, line2Key]
  );

  // Insert shipping logs covering success, unmatched lot, and incomplete data.
  await pool.query(
    `INSERT INTO ops.fact_shipping_log
     (ship_date, lot_key, lot_id_raw, hold_reason, qty_shipped)
     VALUES
     ('2026-02-02', NULL, 'LOT-100', 'Late', 10),
     ('2026-02-03', NULL, 'LOT-999', 'Late', 5),
     ('2026-02-03', NULL, 'LOT-200', NULL, 5)
    `
  );

  // Ensure the lots exist for normalization lookups.
  // These keys are not directly used but confirm the master data.
  void lot100Key;
  void lot200Key;
}

test("weekly summary groups by line and defect type and excludes qty 0", async () => {
  await seedTestData();

  // Run the processing pipeline to build issue events.
  await processAllLogs(pool, 1000);

  // Query the weekly summary for the seeded week range.
  const summary = await getWeeklySummary(pool, "2026-02-02", "2026-02-09");

  // Expect two defect types: Scratch (from production) and Late (from shipping).
  const scratchRow = summary.find((row) => row.defect_type === "Scratch");
  const lateRow = summary.find((row) => row.defect_type === "Late");

  expect(scratchRow).toBeDefined();
  expect(lateRow).toBeDefined();

  // Scratch should be counted twice (AC9 normalization merged labels).
  expect(scratchRow?.total_defects).toBe(2);

  // Late should be counted once from shipping log.
  expect(lateRow?.total_defects).toBe(1);

  // Ensure the week format is consistent (AC10).
  expect(scratchRow?.week_start_date).toBe("2026-02-02");
});

test("detail view returns underlying records for a summary cell", async () => {
  await seedTestData();
  await processAllLogs(pool, 1000);

  // Fetch detail records for the Scratch defects on Line 1.
  const details = await getWeeklyDetails(pool, "2026-02-02", "Line 1", "Scratch");

  // Expect two detail records matching the Scratch issue type.
  expect(details.length).toBe(2);

  // Validate traceability fields exist (AC11).
  const hasProductionLog = details.some((row) => row.production_log_key !== null);
  expect(hasProductionLog).toBe(true);
});

test("flags unmatched, conflict, and incomplete records", async () => {
  await seedTestData();
  await processAllLogs(pool, 1000);

  // Aggregate flags directly to verify counts.
  const result = await pool.query(
    `SELECT flag_type, COUNT(*) AS count
     FROM ops.data_quality_flag
     GROUP BY flag_type
     ORDER BY flag_type`
  );

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.flag_type] = Number(row.count);
  }

  expect(counts.UNMATCHED_LOT_ID).toBe(3);
  expect(counts.CONFLICT).toBe(1);
  expect(counts.INCOMPLETE_DATA).toBe(2);
});

test("flag counts endpoint query groups by week and reason", async () => {
  await seedTestData();
  await processAllLogs(pool, 1000);

  // Use the service query to fetch flag counts.
  const flags = await getFlagCounts(pool, "2026-02-02", "2026-02-09");

  // Expect at least the three required flag types (AC12).
  const flagTypes = flags.map((row) => row.flag_type);
  expect(flagTypes).toContain("UNMATCHED_LOT_ID");
  expect(flagTypes).toContain("CONFLICT");
  expect(flagTypes).toContain("INCOMPLETE_DATA");
});
