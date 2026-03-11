# Ops Weekly Defect Reporting

## Project Description

This service produces weekly defect summaries grouped by production line and defect type, with traceable drill-down details and data-quality flag reporting. It uses the schema in `db/schema.sql` and the data model in `docs/data_design.md`.

## What’s Implemented

- Weekly summary report grouped by production line and defect type.
- Week-range filtering for “last N weeks” style queries.
- Data quality processing to exclude invalid records and flag reasons.
- Drill-down detail query to audit totals.

## Architecture Notes

- The database schema in `db/schema.sql` is the source of truth.
- The service is a small TypeScript + Express API with raw SQL queries.
- `docs/architecture_decision_records.md` and `docs/tech_stack_decision_records.md` are for a different project (Campus Event Hub). The implementation here follows the Ops data design and schema.

## How To Run / Build The Code

1. Create the database schema by running `db/schema.sql` against your Postgres instance.
2. Copy `.env.example` to `.env` and set real credentials.
3. Install dependencies with `npm install`.
4. Start the API with `npm run dev`.
5. In a second terminal, start the React UI with `npm run dev:ui` and visit `http://localhost:5173`.

### Production Build (Serve UI From API)

1. Build the backend and frontend with `npm run build` and `npm run build:ui`.
2. Start the API server with `npm run start` (serves UI from `frontend/dist`).

## Usage Examples

API examples (the UI calls the same endpoints):

- `curl http://localhost:3000/health`
- `curl "http://localhost:3000/reports/weekly-summary?start_week=2026-02-02&end_week=2026-02-09"`
- `curl "http://localhost:3000/reports/flags?start_week=2026-02-02&end_week=2026-02-09"`
- `curl "http://localhost:3000/reports/weekly-details?week_start=2026-02-02&line_name=Line%201&defect_type=Scratch"`
- `curl -X POST http://localhost:3000/jobs/process-logs -H "Content-Type: application/json" -d '{"batch_size":500}'`

## API Endpoints

- `GET /health`
- `GET /` (UI when built and served from `frontend/dist`)
- `GET /reports/weekly-summary?start_week=YYYY-MM-DD&end_week=YYYY-MM-DD`
- `GET /reports/weekly-details?week_start=YYYY-MM-DD&line_name=LINE&defect_type=TYPE`
- `GET /reports/flags?start_week=YYYY-MM-DD&end_week=YYYY-MM-DD`
- `POST /jobs/process-logs` with optional JSON body `{ "batch_size": 500 }`

## Data Quality Processing

The job `/jobs/process-logs` performs the rules in the acceptance criteria.

- Missing/invalid Lot ID → `UNMATCHED_LOT_ID`
- Conflicting Lot ID mappings → `CONFLICT`
- Missing required fields (production line, defect type, date) → `INCOMPLETE_DATA`
- Qty defects = 0 are excluded from totals

## How To Run Tests

Run tests with `npm test`.

## Docker (Intro)

This repo can be run in Docker as a simple test runner.

```bash
docker build -t markdown-demo .
docker run --rm markdown-demo
```

## Formatter, Linter, Type Check, Coverage (TSX Equivalents)

For this TypeScript/TSX project, the equivalents to Python tooling (ruff, mypy, pytest-cov) are:

- Formatter: Prettier
- Linter: ESLint
- Type checker: TypeScript (`tsc`)
- Coverage: Jest (`--coverage`)
- License check: `license-checker` (blocks GPL/AGPL/LGPL in runtime deps)

Run the checks with:

```bash
npm run precommit:check
npm run license:check
```

## Playwright E2E (UI + API)

Start the API and UI in separate terminals:

```bash
npm run dev
npm run dev:ui
```

Run E2E tests (headless, default):

```bash
npx playwright test e2e
```

Run E2E tests in headed mode:

```bash
npx playwright test e2e --headed
```

Run E2E tests in headed mode with slow motion:

```bash
PW_SLOWMO=3000 npx playwright test e2e --headed
```

### Acceptance Criteria Coverage

| AC   | Covered By Test                                                                              |
| ---- | -------------------------------------------------------------------------------------------- |
| AC1  | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC2  | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC3  | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC4  | `tests/reporting.test.ts` "flags unmatched, conflict, and incomplete records"                |
| AC5  | `tests/reporting.test.ts` "flags unmatched, conflict, and incomplete records"                |
| AC6  | `tests/reporting.test.ts` "flags unmatched, conflict, and incomplete records"                |
| AC7  | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC8  | `tests/reporting.test.ts` "flags unmatched, conflict, and incomplete records"                |
| AC9  | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC10 | `tests/reporting.test.ts` "weekly summary groups by line and defect type and excludes qty 0" |
| AC11 | `tests/reporting.test.ts` "detail view returns underlying records for a summary cell"        |
| AC12 | `tests/reporting.test.ts` "flag counts endpoint query groups by week and reason"             |

## Configuration

Required environment variables:

- `NODE_ENV` (`development`, `test`, or `production`)
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSL` (set `true` if your provider requires SSL/TLS)
- `PGSSLREJECTUNAUTHORIZED` (set `false` for providers like Render that use self-signed certs)
- `PORT` (optional, default 3000)
- `LOG_LEVEL` (optional, defaults to `debug` in development and `info` in production)
- `LOG_CONSOLE_LEVEL` (optional, defaults to `debug` in development and `warn` in production)
- `LOG_DIR` (optional, default `logs`)
- `LOG_FILE_NAME` (optional, default `app.log`)

## Logging

- Logging is configured once at startup in [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts).
- Log entries include ISO timestamp, level, module name, message, and JSON metadata when present.
- File logs rotate automatically at `5 MB`, which means the active `app.log` file is renamed and replaced once it grows past that size.
- Rotation prevents a single log file from growing forever and consuming unnecessary disk space over time.
- The rotated files are kept as `app.log.1`, `app.log.2`, and `app.log.3`, with `app.log.1` being the most recent previous file.
- When a new rotation happens, older backups shift forward and anything older than `app.log.3` is discarded.
- In practice, this setup keeps `1` live log file plus `3` backup files, for roughly `20 MB` of retained log history at most.
- Development defaults to verbose console and file logging.
- Production defaults to `INFO`+ in the file and `WARNING`+ in the console.
- Test runs disable file logging to avoid polluting the repo workspace.

### Rotation Walkthrough

The rotation code works like this:

```ts
private rotateFiles(): void {
  const oldestFile = `${this.filePath}.${this.config.maxFiles}`;
  if (fs.existsSync(oldestFile)) {
    fs.unlinkSync(oldestFile);
  }

  for (let index = this.config.maxFiles - 1; index >= 1; index -= 1) {
    const source = `${this.filePath}.${index}`;
    const destination = `${this.filePath}.${index + 1}`;

    if (fs.existsSync(source)) {
      fs.renameSync(source, destination);
    }
  }

  if (fs.existsSync(this.filePath)) {
    fs.renameSync(this.filePath, `${this.filePath}.1`);
  }
}
```

If `this.filePath` is `app.log` and `maxFiles` is `3`, here is what it means:

- `oldestFile` becomes `app.log.3`
- if `app.log.3` already exists, `fs.unlinkSync(...)` deletes it
- this does not archive it anywhere else; it is removed so there is room to keep only the newest `3` backups

Then the loop runs backward:

- it starts at `index = 2`
- then goes to `index = 1`

This creates these source and destination pairs:

- when `index = 2`: source is `app.log.2`, destination is `app.log.3`
- when `index = 1`: source is `app.log.1`, destination is `app.log.2`

So the existing backups shift upward by one slot:

- `app.log.2` becomes `app.log.3`
- `app.log.1` becomes `app.log.2`

The loop must run backward so files do not overwrite each other too early.

After that, the last `if` handles the current live file:

- `app.log` becomes `app.log.1`

So with a full set of files, the rotation result is:

- old `app.log.3` is deleted
- old `app.log.2` becomes `app.log.3`
- old `app.log.1` becomes `app.log.2`
- old `app.log` becomes `app.log.1`
- the next log write creates a fresh current `app.log`

Concrete example:

Before rotation:

```text
app.log     <- current live file
app.log.1   <- most recent backup
app.log.2   <- older backup
app.log.3   <- oldest kept backup
```

After rotation:

```text
app.log     <- new current live file after the next append
app.log.1   <- what used to be app.log
app.log.2   <- what used to be app.log.1
app.log.3   <- what used to be app.log.2
```

And what used to be the old `app.log.3` is gone.

### Signal Handler Note

In the backend entrypoint, the shutdown listeners use:

```ts
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

What this means:

- `process.on(...)` registers the listener once during startup.
- Later, if the running process receives `SIGINT` or `SIGTERM`, Node invokes that listener.
- The listener then starts `shutdown(...)`.
- `shutdown(...)` is `async`, so it returns a promise.
- The `void` does not make `process.on(...)` async and does not change how signals are handled.
- The `void` only makes it explicit that the returned promise is intentionally ignored.
- `process.on(...)` does not use the listener's return value anyway, so this is mainly about code clarity and avoiding floating-promise warnings in some lint setups.
- Saying "we are not awaiting it in this event callback" means the callback itself does not do `await shutdown(...)`.
- Separately, `process.on(...)` does not await the listener's return value either, even if the listener is `async`.

## Notes on Extensibility

- If you want explicit defect quantities, add a `qty_defects` column to the source logs and map it to `fact_issue_event.qty_impacted` in `src/services/ingestService.ts`.
- If you want additional UI features, the JSON API responses are stable for integration.
