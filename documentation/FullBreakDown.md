# Full Breakdown

This document is the end-to-end reference for how this project works in local development and in production.

It is meant to answer the questions that come up after the app is already built:

- What is hosted where?
- Which part is the Render container and which part is the database?
- How do the frontend, backend, Docker container, and PostgreSQL service communicate?
- What happens when a user clicks a button in the UI?
- Where do logs come from?
- When does Sentry capture an error?
- What do local dev, GitHub Actions, pre-commit hooks, and uptime monitoring actually do?

## What This App Does

This app is an operations analytics dashboard for weekly defect reporting.

At a business level, it gives a user:

- weekly defect summaries grouped by production line and defect type
- drill-down detail rows to validate where those totals came from
- data-quality flag counts for excluded records
- a manual processing job to normalize raw logs into reportable issue events

What the user gains:

- visibility into defect trends by week
- traceability from a summary row down to source records
- visibility into bad or excluded data, not just accepted rows
- a way to refresh reporting inputs through the processing job

## The Main Moving Pieces

There are five important systems in this project:

1. GitHub
   Stores the source code and triggers Render deploys when the repo changes.
2. Render Web Service
   Builds the Docker image from the repo and runs the application container.
3. Render PostgreSQL
   Hosts the production database used by the running app.
4. pgAdmin
   Is only a database client. It is not the database host and it is not the app host.
5. UptimeRobot
   Sends GET requests to `/health` to verify that the deployed app is still up.

## Who Hosts What

This is the most important separation to keep straight:

- The Render web service hosts the application container.
- The application container runs the Express server and serves the built frontend and backend API.
- Render PostgreSQL hosts the actual production database.
- pgAdmin is only an external client used to inspect the hosted database and run schema/seed scripts if needed.

So:

- Render is not "the database container" for this app.
- Render Postgres is a separate managed database service.
- The app container talks to that database service over the network using `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.

## Production Pipeline On Render

The production path is:

1. Code is pushed to GitHub.
2. Render pulls the repo.
3. Render reads the root [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile).
4. Render builds the Docker image.
5. Render starts a container from that image.
6. The app container reads runtime environment variables.
7. The app container connects to Render PostgreSQL.
8. The browser loads the frontend from the same Express server that also serves the API.
9. UptimeRobot and Render health checks call `/health` to monitor service availability.

### What Render Does During Build

Render is effectively doing the same Docker workflow you tested locally:

- clone repo
- run Docker build from the root
- build backend output into `dist/`
- build frontend output into `frontend/dist/`
- create the final runtime image
- run the container from that image

The key Docker stages are in [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile):

- `builder`
  Installs dependencies, runs `npm run build`, runs `npm run build:ui`, and prunes dev dependencies.
- `runner`
  Copies only the runtime files into the final image and starts `node dist/index.js`.

### What Lives Inside The Running App Container

In production, the runtime container should have:

- `/app/dist`
  Compiled backend JavaScript.
- `/app/frontend/dist`
  Built frontend static files.
- `/app/node_modules`
  Runtime dependencies.
- `/app/package.json`
- `/app/package-lock.json`
- `/app/logs`
  Created at runtime when file logging is enabled.

The backend starts from:

```text
/app/dist/index.js
```

### Render Web Service Vs Render PostgreSQL

The Render web service and Render PostgreSQL are separate services.

The app container:

- runs Node and Express
- serves the frontend bundle
- handles API requests
- creates a PostgreSQL pool

Render PostgreSQL:

- stores the schema from [db/schema.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/schema.sql)
- stores the data used by the reports
- answers SQL queries from the backend

pgAdmin can connect to Render PostgreSQL using the host and port Render gives you. That is only for admin access. It does not mean pgAdmin is hosting the DB.

## Local Development Pipeline

Local development is intentionally different from production.

### Local Dev Servers

In local dev:

- the backend runs on `http://localhost:3000`
- the frontend Vite dev server runs on `http://localhost:5173`

This is defined by:

- backend entrypoint in [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- frontend dev server config in [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts)

### Why CORS Is Not A Problem In Local Dev

The frontend does not call `http://localhost:3000` directly in code.

Instead, [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts) proxies:

- `/reports`
- `/jobs`
- `/health`

to:

```text
http://localhost:3000
```

That means the browser talks to Vite on `5173`, and Vite forwards API traffic to the backend. This avoids manual CORS handling during local development.

### Local PostgreSQL Setup

Locally, you used a separate PostgreSQL container and pgAdmin.

The most useful mental model is:

- app container or backend process
- database container
- pgAdmin as a DB client

In your local Docker-based debugging path, the port mapping looked like:

- host `8501` -> app container `3000`
- host `5433` -> postgres container `5432`

That means:

- browser used `localhost:8501`
- pgAdmin used `localhost:5433`
- inside the Postgres container, the database itself still listened on `5432`

### Local Docker Production-Style Run

The local production-style container flow is:

1. Build the image locally.
2. Run the app container locally.
3. Inject backend runtime env vars with `--env-file`.
4. Map a host port such as `8501` to the container port `3000`.

Example:

```bash
docker build --build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN" -t markdown-demo .
docker run --rm -p 8501:3000 --env-file .env.docker markdown-demo
```

## Build-Time Vs Run-Time Environment Variables

This distinction matters a lot in this repo.

### Frontend Build-Time Env

`VITE_SENTRY_DSN` is a frontend Vite variable.

It is used during the frontend build in [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts):

```ts
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init(...)
}
```

That means:

- Vite must know `VITE_SENTRY_DSN` while building the frontend
- the value gets baked into the built browser bundle
- changing it later at runtime does not change the already-built frontend files

This is why [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile) has:

```dockerfile
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
```

### Backend Run-Time Env

Backend config is loaded from `process.env` in [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts).

These values are runtime values:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSL`
- `PGSSLREJECTUNAUTHORIZED`
- `PORT`
- `NODE_ENV`
- `LOG_LEVEL`
- `LOG_CONSOLE_LEVEL`
- `LOG_DIR`
- `LOG_FILE_NAME`
- `SENTRY_DSN`

That means the backend can use different runtime values without rebuilding the image.

## The Runtime App Layout

### Backend

The backend is:

- Express application factory in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
- startup entrypoint in [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- configuration loader in [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
- database pool creation in [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts)
- routes in [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) and [src/routes/jobRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/jobRoutes.ts)
- service logic in [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts) and [src/services/ingestService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/ingestService.ts)

### Frontend

The frontend is:

- Vite app root in [frontend/index.html](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/index.html)
- React bootstrap in [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
- main UI logic in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)
- types in [frontend/src/types.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/types.ts)

### Database

The reporting schema is defined in:

- [db/schema.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/schema.sql)

Sample data is in:

- [db/seed.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql)

The backend SQL query strings are centralized in:

- [src/db/queries.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/queries.ts)

## How A User Interaction Flows Through The App

This section maps actual UI interactions to frontend code, backend routes, SQL access, logs, and Sentry behavior.

### Page Load

When the user opens the site:

1. The browser requests `/`.
2. Express serves the built frontend from `frontend/dist` in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts#L80).
3. The browser loads [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx).
4. `main.tsx` imports [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts), initializes frontend Sentry if `VITE_SENTRY_DSN` exists, creates the React root, and renders `<App />` inside `Sentry.ErrorBoundary`.
5. In [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx), `useEffect` immediately calls `loadSummary()` and `loadFlags()`.
6. The frontend sends:
   - `GET /reports/weekly-summary`
   - `GET /reports/flags`
7. The backend handles those routes and responds with JSON.

If the requests fail:

- the backend can log service, app, and HTTP error lines
- the frontend `fetchJson(...)` throws
- the UI catches the error and sets `summaryError` or `flagError`

### Weekly Summary Form

UI code:

- form submit in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)
- button text: `Run Summary`

Flow:

1. User enters dates and clicks `Run Summary`.
2. The UI normalizes the dates to Monday-of-week UTC using `toWeekStart(...)`.
3. `loadSummary(...)` builds a query string and calls:

```text
/reports/weekly-summary?start_week=...&end_week=...
```

4. Backend route [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) validates the dates.
5. It calls `getWeeklySummary(...)` in [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts).
6. The service runs `WEEKLY_SUMMARY_SQL` from [src/db/queries.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/queries.ts).
7. PostgreSQL returns rows.
8. The route returns JSON and the frontend renders the summary table.

Expected logs:

- `Running weekly summary query`
- `Weekly summary query completed`
- `HTTP request completed` for `/reports/weekly-summary`

If the DB throws:

- `Weekly summary query failed`
- `Unhandled request error`
- `HTTP request completed` with status `500`

### Use Default Range Button

UI code:

- `Use Default Range` button in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User clicks `Use Default Range`.
2. The frontend clears the date inputs.
3. `loadSummary()` is called without explicit dates.
4. Backend route [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts#L41) uses `defaultWeekRangeUTC(4)` from [src/utils/date.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/utils/date.ts).
5. That computes the default "last 4 week starts" window.

Important note:

If the default range is newer than the seeded data, the result can legitimately be empty even when the app is healthy.

### Click A Summary Row For Drill-Down

UI code:

- clickable summary table rows in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User clicks a summary row.
2. The frontend auto-populates:
   - `detailWeek`
   - `detailLine`
   - `detailDefect`
3. The frontend calls `loadDetails(...)`.
4. That sends:

```text
/reports/weekly-details?week_start=...&line_name=...&defect_type=...
```

5. Backend route validates required params.
6. `getWeeklyDetails(...)` runs in [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts).
7. SQL returns the detailed rows for that summary cell.
8. The detail table updates.

Expected logs:

- `Running weekly details query`
- `Weekly details query completed`
- `HTTP request completed` for `/reports/weekly-details`

### Detail Drill-Down Form

UI code:

- manual form in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User enters week start, production line, and defect type manually.
2. The frontend normalizes the week date.
3. The frontend calls `/reports/weekly-details`.
4. The backend validates input and queries the detail SQL path.

If required fields are missing or malformed:

- the backend returns `400`
- route-level warning logs are emitted
- the frontend shows the returned error message

Handled `400` requests do not necessarily go to Sentry because they are not unhandled exceptions.

### Flagged Record Counts Form

UI code:

- flag panel form in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User enters or clears the range.
2. `loadFlags(...)` requests `/reports/flags`.
3. Backend route validates the date range.
4. `getFlagCounts(...)` in [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts) runs `FLAG_COUNTS_SQL`.
5. The frontend renders grouped counts such as:
   - `UNMATCHED_LOT_ID`
   - `CONFLICT`
   - `INCOMPLETE_DATA`

Expected logs:

- `Running flag counts query`
- `Flag counts query completed`

### Process Logs Button

UI code:

- `Run Processing Job` button in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User optionally enters a batch size.
2. Frontend sends:

```text
POST /jobs/process-logs
```

3. Backend route [src/routes/jobRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/jobRoutes.ts) reads `batch_size`.
4. It logs `Processing logs requested`.
5. It calls `processAllLogs(...)` in [src/services/ingestService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/ingestService.ts).
6. The ingest service:
   - reads unprocessed production and shipping logs
   - normalizes lots and issue types
   - inserts issue events
   - inserts data quality flags when rows must be excluded
7. The route returns processed/flagged totals.
8. The frontend displays:

```text
Processed: X | Flagged: Y
```

Expected logs:

- `Processing logs requested`
- ingest service start/completion logs
- `Data quality flag recorded` warnings when excluded rows are flagged

### Test Frontend Sentry Button

UI code:

- `Test Frontend Sentry` button in [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)

Flow:

1. User clicks `Test Frontend Sentry`.
2. The frontend calls:

```ts
Sentry.captureException(new Error("Frontend Sentry test"));
```

3. If `VITE_SENTRY_DSN` was injected during the frontend build, Sentry can send that event to the frontend Sentry project.

This does not involve the backend route layer.

## What Happens When A Backend Request Fails

This is the standard async failure path.

1. A route handler is wrapped by `asyncHandler(...)` in [src/utils/asyncHandler.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/utils/asyncHandler.ts).
2. The route calls a service function.
3. The service throws or rethrows an error.
4. The route promise rejects.
5. `asyncHandler` does `.catch(next)`.
6. Express enters error middleware.
7. Sentry's Express error handler can capture the error if `SENTRY_DSN` is enabled.
8. The custom app error handler in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) logs `Unhandled request error`.
9. The client receives:

```json
{ "error": "Internal server error" }
```

10. After the response finishes, the HTTP logger writes a `500` log.

### What The Frontend Does With A Rejected Request

The frontend helper [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx) uses `fetchJson(...)`.

If the response is not OK:

1. `fetchJson(...)` reads the response body.
2. It throws a new `Error(...)`.
3. The caller catches it in the React component.
4. The UI stores an error string in state and renders it in the panel.

So a backend rejection becomes:

- backend logs
- optional backend Sentry
- HTTP `500`
- frontend thrown `Error`
- visible UI error message

## Logging System

The logging system is configured in [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).

### Where Logger Configuration Comes From

[src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts) provides:

- `LOG_LEVEL`
- `LOG_CONSOLE_LEVEL`
- `LOG_DIR`
- `LOG_FILE_NAME`

If levels are missing, defaults depend on `NODE_ENV`.

### Where Logger Startup Happens

[src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts):

1. calls `configureLogger(...)`
2. logs `Application startup`
3. creates the pool
4. creates the app
5. logs `HTTP server listening`

### Main Logger Sources

- `index`
  startup and shutdown lifecycle
- `db.pool`
  database pool creation and pool errors
- `http`
  request completion logs
- `app`
  app creation and unhandled request errors
- `service.report`
  report query lifecycle
- `service.ingest`
  processing job lifecycle and data quality flags
- `routes.report`
  handled validation warnings
- `routes.job`
  processing job request logs

### Console Logs Vs File Logs

The logger writes to:

- console
- local log files such as `logs/app.log`

In Render:

- console logs are what you see in the Events/Logs view
- file logs still exist inside the container, but container files are ephemeral

So the operationally important production log stream is Render's aggregated console log view.

## Sentry System

### Backend Sentry

Backend Sentry is initialized in [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts) if `SENTRY_DSN` exists.

[src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) imports that file before startup finishes.

[src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) registers:

```ts
Sentry.setupExpressErrorHandler(app);
```

So backend Sentry can capture:

- request-path exceptions that reach Express error middleware
- uncaught exceptions
- unhandled promise rejections

### Frontend Sentry

Frontend Sentry is initialized in [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts) if `VITE_SENTRY_DSN` exists.

[frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx) wraps the app in:

```tsx
<Sentry.ErrorBoundary fallback={SentryFallback}>
  <App />
</Sentry.ErrorBoundary>
```

So frontend Sentry can capture:

- render/update errors inside the React tree
- explicit captures such as `Sentry.captureException(...)`
- some browser-global failures if initialized early enough

### Logging Vs Sentry

Logging and Sentry are related but not identical.

- logging records structured local operational events
- Sentry captures runtime failures for alerting and investigation

An error can show up in both systems, but they are not the same mechanism.

## Health Checks And Uptime Monitoring

The app exposes:

```text
GET /health
```

in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts).

This route returns:

```json
{ "status": "ok" }
```

How it is used:

- Render health checks should point at `/health`
- Playwright uses `/health` to wait for the API server locally
- UptimeRobot can monitor:

```text
https://<your-render-service>.onrender.com/health
```

That gives you both internal and external monitoring.

## Pre-Commit Hooks

This repo uses Husky.

The pre-commit hook is in [.husky/pre-commit](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.husky/pre-commit).

It runs:

- `npm run license:check`
- `npm run precommit:check`

From [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json):

- `license:check`
  Blocks copyleft runtime licenses in production dependencies.
- `precommit:check`
  Runs:
  - Prettier check
  - ESLint
  - TypeScript `tsc --noEmit`
  - Jest with coverage

So before code is committed locally, the repo already checks formatting, linting, type safety, and test health.

## GitHub Actions

The CI workflow is in [.github/workflows/ci.yml](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.github/workflows/ci.yml).

It runs on pull requests.

### What CI Actually Does

1. Starts a PostgreSQL service container in GitHub Actions.
2. Checks out the repo.
3. Sets up Node 20.
4. Runs `npm ci`.
5. Installs Playwright browsers.
6. Seeds the CI database with:
   - [db/schema.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/schema.sql)
   - [db/seed.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql)
7. Runs `npm run precommit:check`.
8. Runs Playwright E2E tests.

So CI verifies:

- code style
- linting
- type correctness
- unit/integration tests
- browser E2E behavior

CI does not currently build Docker as part of the GitHub Actions workflow.

## Automated Tests

### Jest

`npm test` runs Jest through [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json).

Important test files:

- [tests/reporting.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/reporting.test.ts)
- [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts)
- [tests/helpers.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/helpers.ts)

### Playwright

[playwright.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/playwright.config.ts) starts:

- `npm run dev`
- `npm run dev:ui`

and waits for:

- `http://localhost:3000/health`
- `http://localhost:5173`

Then [e2e/weekly-reporting.spec.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/e2e/weekly-reporting.spec.ts) tests the real browser flow:

- load weekly summary
- click a summary row
- verify detail drill-down
- load flag counts

## The Role Of pgAdmin

pgAdmin is not part of the deployed app.

It is useful because it lets you:

- inspect the database schema
- connect to local Postgres
- connect to Render Postgres
- manually run schema or seed scripts if needed
- validate connection details like host, port, username, and database name

So pgAdmin is a client/admin tool, not part of the app runtime.

## Important Operational Clarifications

### Render App Container Vs Render Database

- The app container serves frontend and backend.
- The database is separate.
- The app reaches the database over the network.

### `PORT` Vs `PGPORT`

- `PORT`
  Express app listening port.
- `PGPORT`
  PostgreSQL server port.

These should never be confused with each other.

### Localhost Means Different Things In Different Places

- On your laptop, `localhost` means your laptop.
- Inside a container, `localhost` means that container itself.
- On Render, `localhost` means the running app container, not your laptop and not the hosted database.

### A Container Is Not The Database By Default

Even though Docker can run databases, this project's production database is a managed Render PostgreSQL service, not a DB process inside the app container.

## Recommended Reading After This

If you want deeper detail after this overview:

- [documentation/build/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/README.md)
- [documentation/build/TestDevContainerAnalysis.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/TestDevContainerAnalysis.md)
- [documentation/frontend/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/README.md)
- [documentation/logging/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/README.md)
- [documentation/logging-integrations/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/README.md)
- [documentation/testing/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/README.md)
- [documentation/sentry/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/README.md)
