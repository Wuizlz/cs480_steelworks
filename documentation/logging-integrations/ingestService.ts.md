# Understanding `src/services/ingestService.ts`

This document explains how [src/services/ingestService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/ingestService.ts) uses logging during batch processing and data-quality handling.

This is the busiest logging integration file in the project. It does not just log one request or one query. It logs an entire batch-processing workflow.

## Why This File Matters for Logging

This file logs:

- batch start for production logs
- batch completion for production logs
- batch failures for production logs
- batch start for shipping logs
- batch completion for shipping logs
- batch failures for shipping logs
- combined job start/completion
- every data-quality flag inserted into the database

So this file gives the app its strongest operational visibility into background-style data processing.

## Logging-Relevant Structure

The logging in this file centers around these parts:

```ts
const logger = getLogger("service.ingest");

async function insertFlag(...) {
  await client.query(INSERT_DQ_FLAG_SQL, [...]);

  logger.warn("Data quality flag recorded", {
    flag_type: params.flagType,
    source: params.source,
    reason: params.reason,
    ...
  });
}

export async function processProductionLogs(...) {
  let processed = 0;
  let flagged = 0;
  let fetched = 0;

  logger.info("Production log processing started", {
    batch_size: batchSize,
  });

  try {
    ...
    fetched = rowsResult.rows.length;
    ...
    await client.query("COMMIT");
    logger.info("Production log processing completed", {
      batch_size: batchSize,
      fetched,
      processed,
      flagged,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Production log processing failed", {
      batch_size: batchSize,
      fetched,
      processed,
      flagged,
      ...toErrorMeta(error),
    });
    throw error;
  } finally {
    client.release();
  }
}
```

The same structure is repeated for shipping logs, and `processAllLogs(...)`
wraps both with combined start/completion logs.

## Section 1: Module Logger

```ts
const logger = getLogger("service.ingest");
```

All logs from this file are grouped under `service.ingest`.

That is useful because this file is doing several things at once:

- normalization
- validation
- lookup logic
- transactional inserts
- flagging
- batch orchestration

A single logger identity keeps all of that activity tied to the ingest service layer.

## Section 2: Why `insertFlag(...)` Logs Warnings

```ts
logger.warn("Data quality flag recorded", {
  flag_type: params.flagType,
  source: params.source,
  reason: params.reason,
  ...
});
```

This is an important design choice.

A data-quality flag is not necessarily a crash, but it is an abnormal record that
was excluded or marked for attention.

That is exactly what warnings are for:

- something recoverable happened
- the system continued
- but it is still operationally meaningful

Examples recorded here:

- unmatched lot IDs
- conflicting lot-to-line mappings
- incomplete data

Because the log includes details like source and reason, operators can see not
just that a flag was created, but why it happened.

## Section 3: Batch Start Logs

Each processing function starts with a log like:

```ts
logger.info("Production log processing started", {
  batch_size: batchSize,
});
```

or:

```ts
logger.info("Shipping log processing started", {
  batch_size: batchSize,
});
```

Why this matters:

- confirms the job began
- records the configured batch size
- helps correlate later completion or failure logs

This is especially useful for manual job runs or scheduled executions.

## Section 4: Tracking Counters for the Completion Log

Both batch processors maintain:

```ts
let processed = 0;
let flagged = 0;
let fetched = 0;
```

These counters are not only useful for business logic. They are also useful for logging.

At completion time, the logger records:

- how many rows were fetched
- how many records became issue events
- how many records were flagged

That gives a compact summary of the batch outcome.

## Section 5: Completion Logs

After a successful transaction commit, the file logs:

```ts
logger.info("Production log processing completed", {
  batch_size: batchSize,
  fetched,
  processed,
  flagged,
});
```

and similarly for shipping.

This is a very strong operational log because it tells you:

- the job finished
- how much work it examined
- how much useful output it produced
- how much data was flagged

This is often the most important normal-path log in the whole file.

## Section 6: Failure Logs

On failure, the file does:

```ts
await client.query("ROLLBACK");
logger.error("Production log processing failed", {
  batch_size: batchSize,
  fetched,
  processed,
  flagged,
  ...toErrorMeta(error),
});
throw error;
```

This is good logging discipline.

Why:

- the DB transaction is rolled back first
- the log captures how far the batch got
- the original error is preserved and rethrown

So logging here tells you not just that the batch failed, but how much work had already happened before it failed.

## Section 7: Combined Job Logs

At the top-level wrapper, the file logs:

```ts
logger.info("Combined log processing requested", {
  batch_size: batchSize,
});
```

and later:

```ts
logger.info("Combined log processing completed", {
  batch_size: batchSize,
  production_processed: production.processed,
  production_flagged: production.flagged,
  shipping_processed: shipping.processed,
  shipping_flagged: shipping.flagged,
});
```

This gives a top-level view of the whole job call.

Why this matters:

- it connects the route-level request to the lower-level batch logs
- it summarizes both production and shipping work in one place

## Section 8: Why Logging Lives in Helpers and Main Flows

This file does not log every helper function.

For example:

- `normalizeLabel(...)` does not log
- `normalizeLotId(...)` does not log
- `deriveProductionQty(...)` does not log

That is a good restraint.

If those tiny helpers logged every invocation, the logs would become far too noisy.

Instead, the file logs at the meaningful operational points:

- batch lifecycle
- data-quality events
- failures

That is the right granularity.

## Final Mental Model

You can think of `src/services/ingestService.ts` as the batch-processing heartbeat of the logging system.

It tells you:

- when processing started
- how much work was fetched
- how much was processed
- what was flagged and why
- whether the batch succeeded or failed

That makes it the strongest source of operational logs for the ingest pipeline.
