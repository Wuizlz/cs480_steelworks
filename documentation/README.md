# Ops Weekly Summary Scaffolding (Learning Notes)

This repo currently includes a **scaffold-only** implementation for the operations weekly summary feature. This document explains how the pieces fit together, what each file is responsible for, and how it connects to the existing `db/` schema and `docs/` requirements. No business logic is implemented yet; the code provides the **shape** of the feature so the next step can be a focused, low-risk implementation.

## What this feature does (at a glance)

The goal is to produce **weekly issue summaries** grouped by **Production Line** and **Defect Type**, with:
- A selectable week range (e.g., last 4 weeks)
- Consistent labels and week formatting
- Excluded/flagged counts by reason
- Drill-down access to the underlying records for auditability

All of this is represented by **types and interfaces**, with the **service** and **repository** left as stubs.

## Key files and responsibilities

### `src/ops-weekly-summary/types.ts`
Defines all DTOs and domain types used by the feature:
- `WeekRange`: ISO week boundaries used for reporting.
- `WeeklySummaryRow`: one row per (week, production line, defect type) with total defects.
- `ExcludedCountRow`: counts of excluded records by reason and week.
- `UnderlyingRecordsQuery` and `UnderlyingRecord`: inputs/outputs for drill-down audit details.
- `WeeklyIssueSummaryReport`: the top-level report container for summary + exclusions.

These types are designed to align with the `ops` schema in `db/schema.sql`, especially:
- `ops.fact_issue_event` for reportable issue events
- `ops.data_quality_flag` for excluded/flagged counts

### `src/ops-weekly-summary/repository.ts`
Defines the **repository interface** for raw SQL data access. No SQL strings are provided yet (per constraints), only method signatures:
- `fetchWeeklySummary(range)`
- `fetchExcludedCounts(range)`
- `fetchUnderlyingRecords(query)`

Any future implementation should:
- Use **raw SQL**
- Apply all matching + exclusion rules (Lot ID validity, conflicts, required fields, zero qty)
- Apply normalization (line/defect labels) as defined in `db/schema.sql` normalization functions

### `src/ops-weekly-summary/service.ts`
Defines the **service layer** as a thin orchestration boundary.
It exposes two methods:
- `getWeeklySummaryReport(range)` → returns `WeeklyIssueSummaryReport`
- `getUnderlyingRecords(query)` → returns `UnderlyingRecord[]`

The service is expected to call the repository methods and compose the final output, but currently throws `Not implemented`.

### `src/ops-weekly-summary/__tests__/weeklyIssueSummary.service.test.ts`
Provides **unit test stubs only** using `test.todo(...)`, one per acceptance criterion.
This gives a direct mapping from requirements to tests without implementing behavior yet.

## How this maps to the database schema

The data design and schema in `db/schema.sql` already include:
- Normalized dimensions for production lines and issue types
- Fact tables for production and shipping logs
- `ops.fact_issue_event` for reportable issue records
- `ops.data_quality_flag` for invalid/incomplete/conflicting records

This scaffold expects the repository layer to query those tables and produce:
- Aggregated weekly totals
- Drill-down rows for auditability
- Excluded counts by reason

## What is intentionally missing

This scaffold is intentionally minimal and does **not** include:
- Any SQL implementation or query strings
- Any DB connection wiring
- Any controllers or routes
- Any transformation logic

Those pieces are intentionally deferred to keep the focus on correctness and clarity of the feature contract.

## Next step (when you choose to implement)

A typical next step is to implement a concrete repository with raw SQL:
- A weekly aggregation query
- An exclusions aggregation query
- A drill-down query by week + line + defect type

Then update the service to wire these together and replace the `Not implemented` throws.
