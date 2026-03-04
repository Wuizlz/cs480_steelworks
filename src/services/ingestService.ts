/**
 * Data quality processing and issue event normalization.
 *
 * This service turns raw production/shipping log rows into
 * reportable issue events while flagging excluded records.
 */

import { Pool, PoolClient } from "pg";
import {
  FIND_LOT_ASSIGNMENT_SQL,
  FIND_LOT_BY_KEY_SQL,
  FIND_LOT_SQL,
  INSERT_DQ_FLAG_SQL,
  INSERT_ISSUE_EVENT_SQL,
  INSERT_LOT_ASSIGNMENT_SQL,
  NORMALIZE_LABEL_SQL,
  NORMALIZE_LOT_ID_SQL,
  UNPROCESSED_PRODUCTION_LOGS_SQL,
  UNPROCESSED_SHIPPING_LOGS_SQL,
  UPDATE_PROD_LOG_LOT_SQL,
  UPDATE_SHIP_LOG_LOT_SQL,
  UPSERT_ISSUE_TYPE_SQL,
} from "../db/queries";
import { ProcessResult } from "../types";
import { getWeekStartUTC, parseIsoDateUTC, toIsoDateUTC } from "../utils/date";

// Batch size default keeps per-transaction work bounded.
const DEFAULT_BATCH_SIZE = 500;

/**
 * Normalize a DATE value from pg into a YYYY-MM-DD string.
 *
 * Time complexity: O(1) because it formats a single date value.
 * Space complexity: O(1) because it allocates a constant-size string.
 */
function coerceDateToIso(value: string | Date): string {
  // If pg returns a Date object, convert via toISOString.
  if (value instanceof Date) {
    return toIsoDateUTC(value);
  }

  // Otherwise assume the value is already a YYYY-MM-DD string.
  return value;
}

/**
 * Insert a data quality flag for an excluded record.
 *
 * Time complexity: O(1) for a single insert.
 * Space complexity: O(1).
 */
async function insertFlag(
  client: PoolClient,
  params: {
    flagType: "UNMATCHED_LOT_ID" | "CONFLICT" | "INCOMPLETE_DATA";
    source: "PRODUCTION_LOG" | "SHIPPING_LOG";
    reason: string;
    missingFields?: string | null;
    lotIdRaw?: string | null;
    lotIdNorm?: string | null;
    productionLogKey?: number | null;
    shippingLogKey?: number | null;
  },
): Promise<void> {
  await client.query(INSERT_DQ_FLAG_SQL, [
    params.flagType,
    params.source,
    params.reason,
    params.missingFields ?? null,
    params.lotIdRaw ?? null,
    params.lotIdNorm ?? null,
    params.productionLogKey ?? null,
    params.shippingLogKey ?? null,
    null,
  ]);
}

/**
 * Normalize a label (e.g., issue type) using the DB function.
 *
 * Time complexity: O(1) for a single DB call.
 * Space complexity: O(1).
 */
async function normalizeLabel(
  client: PoolClient,
  label: string,
): Promise<string | null> {
  const result = await client.query(NORMALIZE_LABEL_SQL, [label]);
  return result.rows[0]?.label_norm ?? null;
}

/**
 * Normalize a raw lot id using the DB function.
 *
 * Time complexity: O(1) for a single DB call.
 * Space complexity: O(1).
 */
async function normalizeLotId(
  client: PoolClient,
  lotIdRaw: string,
): Promise<string | null> {
  const result = await client.query(NORMALIZE_LOT_ID_SQL, [lotIdRaw]);
  return result.rows[0]?.lot_id_norm ?? null;
}

/**
 * Upsert an issue type by normalized label and source.
 *
 * Time complexity: O(1) for a single upsert.
 * Space complexity: O(1).
 */
async function ensureIssueType(
  client: PoolClient,
  source: "PRODUCTION" | "SHIPPING",
  issueLabel: string,
): Promise<number> {
  // Normalize the label to enforce consistent naming (AC9).
  const normalized = await normalizeLabel(client, issueLabel);

  if (!normalized) {
    // Return -1 to signal invalid/empty labels to the caller.
    return -1;
  }

  // Upsert using the normalized label to prevent duplicates.
  const result = await client.query(UPSERT_ISSUE_TYPE_SQL, [
    source,
    issueLabel,
    normalized,
  ]);

  return Number(result.rows[0].issue_type_key);
}

/**
 * Resolve lot_key from lot_id_raw and update the source log row.
 *
 * Time complexity: O(1) because it performs a constant number of queries.
 * Space complexity: O(1).
 */
async function resolveLotKey(
  client: PoolClient,
  params: {
    source: "PRODUCTION_LOG" | "SHIPPING_LOG";
    sourceKey: number;
    lotKey: number | null;
    lotIdRaw: string | null;
  },
): Promise<{ lotKey: number; lotIdNorm: string | null } | "UNMATCHED"> {
  // If the lot_key already exists, reuse it for traceability.
  if (params.lotKey) {
    const lotRow = await client.query(FIND_LOT_BY_KEY_SQL, [params.lotKey]);
    const lotIdNorm = lotRow.rows[0]?.lot_id_norm ?? null;
    return { lotKey: params.lotKey, lotIdNorm };
  }

  // Missing raw lot id means we cannot resolve it.
  if (!params.lotIdRaw) {
    return "UNMATCHED";
  }

  // Normalize the raw lot id to a canonical format.
  const lotIdNorm = await normalizeLotId(client, params.lotIdRaw);

  if (!lotIdNorm) {
    // Invalid/malformed lot id.
    return "UNMATCHED";
  }

  // Lookup an existing lot row by normalized id.
  const lotResult = await client.query(FIND_LOT_SQL, [lotIdNorm]);
  const found = lotResult.rows[0];

  if (!found) {
    // Lot not found in the master list.
    return "UNMATCHED";
  }

  const resolvedKey = Number(found.lot_key);

  // Persist the resolved lot_key back to the source log for auditing.
  if (params.source === "PRODUCTION_LOG") {
    await client.query(UPDATE_PROD_LOG_LOT_SQL, [
      resolvedKey,
      params.sourceKey,
    ]);
  } else {
    await client.query(UPDATE_SHIP_LOG_LOT_SQL, [
      resolvedKey,
      params.sourceKey,
    ]);
  }

  return { lotKey: resolvedKey, lotIdNorm };
}

/**
 * Determine the defect quantity for a production log row.
 *
 * Time complexity: O(1).
 * Space complexity: O(1).
 */
function deriveProductionQty(row: Record<string, unknown>): number {
  // Use line_issue_flag when available: true => 1, false => 0.
  if (row.line_issue_flag === true) {
    return 1;
  }

  if (row.line_issue_flag === false) {
    return 0;
  }

  // Default to 1 when no explicit quantity is provided.
  return 1;
}

/**
 * Determine the defect quantity for a shipping log row.
 *
 * Time complexity: O(1).
 * Space complexity: O(1).
 */
function deriveShippingQty(): number {
  // Shipping issues are counted as 1 defect per record by default.
  return 1;
}

/**
 * Process unhandled production log rows into issue events.
 *
 * Time complexity: O(n) in the number of unprocessed logs fetched.
 * Space complexity: O(1) aside from the input batch.
 */
export async function processProductionLogs(
  pool: Pool,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessResult> {
  let processed = 0;
  let flagged = 0;

  // Use a dedicated client so all operations share a transaction.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch the next batch of unprocessed production logs.
    const rowsResult = await client.query(UNPROCESSED_PRODUCTION_LOGS_SQL, [
      batchSize,
    ]);

    for (const row of rowsResult.rows) {
      // Required fields: run_date, production_line_key, primary_issue, lot_id.
      if (!row.run_date || !row.production_line_key) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "PRODUCTION_LOG",
          reason: "Missing run_date or production_line_key",
          missingFields: "run_date, production_line_key",
          lotIdRaw: row.lot_id_raw ?? null,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      // Resolve the lot key, or flag as unmatched if missing/invalid.
      const lotResolution = await resolveLotKey(client, {
        source: "PRODUCTION_LOG",
        sourceKey: row.production_log_key,
        lotKey: row.lot_key ?? null,
        lotIdRaw: row.lot_id_raw ?? null,
      });

      if (lotResolution === "UNMATCHED") {
        await insertFlag(client, {
          flagType: "UNMATCHED_LOT_ID",
          source: "PRODUCTION_LOG",
          reason: "Missing or invalid Lot ID",
          missingFields: "lot_id",
          lotIdRaw: row.lot_id_raw ?? null,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      // Defect type is required to classify the issue.
      if (!row.primary_issue) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "PRODUCTION_LOG",
          reason: "Missing defect type (primary_issue)",
          missingFields: "primary_issue",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      // Ensure the issue type exists and fetch its key.
      const issueTypeKey = await ensureIssueType(
        client,
        "PRODUCTION",
        row.primary_issue,
      );
      if (issueTypeKey < 0) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "PRODUCTION_LOG",
          reason: "Invalid defect type label",
          missingFields: "primary_issue",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      // Enforce consistent lot-to-line mapping (AC6).
      const assignmentResult = await client.query(FIND_LOT_ASSIGNMENT_SQL, [
        lotResolution.lotKey,
      ]);
      const assignedLineKey =
        assignmentResult.rows[0]?.production_line_key ?? null;

      if (
        assignedLineKey &&
        Number(assignedLineKey) !== Number(row.production_line_key)
      ) {
        await insertFlag(client, {
          flagType: "CONFLICT",
          source: "PRODUCTION_LOG",
          reason: "Lot ID mapped to multiple production lines",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      if (!assignedLineKey) {
        // Record the first observed production line for this lot.
        await client.query(INSERT_LOT_ASSIGNMENT_SQL, [
          lotResolution.lotKey,
          row.production_line_key,
        ]);
      }

      // Compute the defect quantity (qty_impacted).
      const qtyImpacted = deriveProductionQty(row);

      // Skip zero-quantity defects from totals (AC7).
      if (qtyImpacted <= 0) {
        processed += 1;
        continue;
      }

      // Convert run_date to a week_start_date for consistent grouping (AC10).
      const runDateIso = coerceDateToIso(row.run_date);
      const runDate = parseIsoDateUTC(runDateIso);

      if (!runDate) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "PRODUCTION_LOG",
          reason: "Invalid run_date",
          missingFields: "run_date",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          productionLogKey: row.production_log_key,
        });
        flagged += 1;
        continue;
      }

      const weekStart = toIsoDateUTC(getWeekStartUTC(runDate));

      // Insert the issue event for reporting.
      await client.query(INSERT_ISSUE_EVENT_SQL, [
        "PRODUCTION",
        runDateIso,
        weekStart,
        row.production_line_key,
        lotResolution.lotKey,
        issueTypeKey,
        qtyImpacted,
        row.production_log_key,
        null,
      ]);

      processed += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    // Roll back the transaction to keep the DB consistent on failure.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Always release the client to avoid pool leaks.
    client.release();
  }

  return { processed, flagged };
}

/**
 * Process unhandled shipping log rows into issue events.
 *
 * Time complexity: O(n) in the number of unprocessed logs fetched.
 * Space complexity: O(1) aside from the input batch.
 */
export async function processShippingLogs(
  pool: Pool,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ProcessResult> {
  let processed = 0;
  let flagged = 0;

  // Use a dedicated client for transactional consistency.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch the next batch of unprocessed shipping logs.
    const rowsResult = await client.query(UNPROCESSED_SHIPPING_LOGS_SQL, [
      batchSize,
    ]);

    for (const row of rowsResult.rows) {
      // Required field: ship_date.
      if (!row.ship_date) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "SHIPPING_LOG",
          reason: "Missing ship_date",
          missingFields: "ship_date",
          lotIdRaw: row.lot_id_raw ?? null,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      // Resolve the lot key, or flag as unmatched if missing/invalid.
      const lotResolution = await resolveLotKey(client, {
        source: "SHIPPING_LOG",
        sourceKey: row.shipping_log_key,
        lotKey: row.lot_key ?? null,
        lotIdRaw: row.lot_id_raw ?? null,
      });

      if (lotResolution === "UNMATCHED") {
        await insertFlag(client, {
          flagType: "UNMATCHED_LOT_ID",
          source: "SHIPPING_LOG",
          reason: "Missing or invalid Lot ID",
          missingFields: "lot_id",
          lotIdRaw: row.lot_id_raw ?? null,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      // The shipping log lacks a line; use lot_line_assignment to infer it.
      const assignmentResult = await client.query(FIND_LOT_ASSIGNMENT_SQL, [
        lotResolution.lotKey,
      ]);
      const assignedLineKey =
        assignmentResult.rows[0]?.production_line_key ?? null;

      if (!assignedLineKey) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "SHIPPING_LOG",
          reason: "Missing production line for lot assignment",
          missingFields: "production_line",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      // Defect type is required (hold_reason).
      if (!row.hold_reason) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "SHIPPING_LOG",
          reason: "Missing defect type (hold_reason)",
          missingFields: "hold_reason",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      // Ensure the issue type exists and fetch its key.
      const issueTypeKey = await ensureIssueType(
        client,
        "SHIPPING",
        row.hold_reason,
      );
      if (issueTypeKey < 0) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "SHIPPING_LOG",
          reason: "Invalid defect type label",
          missingFields: "hold_reason",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      // Compute defect quantity (default 1).
      const qtyImpacted = deriveShippingQty();

      if (qtyImpacted <= 0) {
        processed += 1;
        continue;
      }

      // Convert ship_date to week_start_date.
      const shipDateIso = coerceDateToIso(row.ship_date);
      const shipDate = parseIsoDateUTC(shipDateIso);

      if (!shipDate) {
        await insertFlag(client, {
          flagType: "INCOMPLETE_DATA",
          source: "SHIPPING_LOG",
          reason: "Invalid ship_date",
          missingFields: "ship_date",
          lotIdRaw: row.lot_id_raw ?? null,
          lotIdNorm: lotResolution.lotIdNorm,
          shippingLogKey: row.shipping_log_key,
        });
        flagged += 1;
        continue;
      }

      const weekStart = toIsoDateUTC(getWeekStartUTC(shipDate));

      // Insert the issue event for reporting.
      await client.query(INSERT_ISSUE_EVENT_SQL, [
        "SHIPPING",
        shipDateIso,
        weekStart,
        assignedLineKey,
        lotResolution.lotKey,
        issueTypeKey,
        qtyImpacted,
        null,
        row.shipping_log_key,
      ]);

      processed += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    // Roll back the transaction to keep the DB consistent.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Release the client to avoid connection leaks.
    client.release();
  }

  return { processed, flagged };
}

/**
 * Process both production and shipping logs in a single call.
 *
 * Time complexity: O(n + m) for production and shipping batches.
 * Space complexity: O(1) aside from the fetched batches.
 */
export async function processAllLogs(
  pool: Pool,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<{ production: ProcessResult; shipping: ProcessResult }> {
  // Run production and shipping processing sequentially to reduce lock contention.
  const production = await processProductionLogs(pool, batchSize);
  const shipping = await processShippingLogs(pool, batchSize);

  return { production, shipping };
}
