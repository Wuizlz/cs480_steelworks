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

## Docker

The Dockerfile now builds a production image for the full app:

- compiles the TypeScript API into `dist/`
- builds the React UI into `frontend/dist/`
- serves the built UI from the Express server on port `3000`

Build the image:

```bash
docker build \
  --build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN" \
  -t markdown-demo .
```

Run the container with your backend environment variables:

```bash
docker run --rm -p 3000:3000 --env-file .env markdown-demo
```

Important:

- backend env vars such as `PGHOST`, `PGUSER`, `PGPASSWORD`, `SENTRY_DSN`, and `PORT` are read at container runtime
- `VITE_SENTRY_DSN` is a frontend Vite variable, so it must be provided at image build time with `--build-arg`
- if you change `VITE_SENTRY_DSN`, rebuild the image so the new value is baked into the frontend bundle
- build output details are documented in `documentation/build/BuildArtifactsAndOutputPaths.md`

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
- `SENTRY_DSN` (optional, backend Sentry DSN for the Express API)
- `VITE_SENTRY_DSN` (optional, frontend Sentry DSN exposed to the React app by Vite)

## Notes on Extensibility

- If you want explicit defect quantities, add a `qty_defects` column to the source logs and map it to `fact_issue_event.qty_impacted` in `src/services/ingestService.ts`.
- If you want additional UI features, the JSON API responses are stable for integration.
