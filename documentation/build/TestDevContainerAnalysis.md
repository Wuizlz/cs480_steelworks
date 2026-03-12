# Test/Dev Container Analysis

This document explains the local container workflow we debugged:

- a PostgreSQL environment running in Docker
- an application container that serves both the backend API and the built frontend
- how those two environments communicate
- why certain failures happened
- which files in the repo control each part of that flow

This is a runtime-analysis document, not just a Docker command reference.

## Why This Exists

During local Docker testing, several questions came up:

1. Which container is serving the frontend and backend?
2. Why does the frontend not need its own Docker port in production?
3. What is the difference between host ports and container ports?
4. Why did `PGHOST=localhost` fail inside the app container?
5. Why did the app later fail with password authentication errors?
6. Why did the default summary range return no rows even when the app was running?
7. Which log lines were normal, and which ones indicated a real problem?

This document answers those questions with concrete file references.

## High-Level Topology

In the local Docker debugging flow, there were effectively two services:

1. The application container
2. The PostgreSQL container

The application container contains:

- the compiled backend in `dist/`
- the built frontend in `frontend/dist/`
- one Node/Express process started with `node dist/index.js`

The PostgreSQL container contains:

- the Postgres server
- the project database, such as `testdb`

The key architectural point is:

- in development, the frontend can run separately through Vite on port `5173`
- in the Docker/runtime path, Express serves the built frontend itself

So in Docker, the app behaves like one server that serves:

- static frontend files
- backend API endpoints

## Source File Map

These files define the container/runtime behavior:

- [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile)
  Builds the production-style application image.
- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
  Starts the backend process, configures logging, creates the database pool, and listens for HTTP traffic.
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
  Wires Express routes, static frontend serving, HTTP logging, Sentry, and the centralized error handler.
- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
  Loads environment variables and turns them into typed runtime config.
- [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts)
  Creates the PostgreSQL pool using the resolved env config.
- [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts)
  Executes report queries and emits report-level logs.
- [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts)
  Applies default week ranges and invokes the reporting service.
- [src/utils/date.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/utils/date.ts)
  Computes the default week range.
- [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts)
  Controls log thresholds, console output, file output, and metadata serialization.
- [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts)
  Shows that the frontend has its own dev server only in development.
- [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
  Bootstraps the frontend app.
- [db/seed.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql)
  Defines the sample data that made some date-range behavior confusing later.

## One Server vs Two Servers

One of the main points of confusion was whether the frontend "needs its own server."

The answer is:

- yes in development
- no as a separate server in the Docker/runtime path

### Development mode

In development:

- the frontend runs through Vite on port `5173`
- the backend runs through Express on port `3000`

That is defined in [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts), which sets:

- the Vite dev server port to `5173`
- proxy targets like `/reports` and `/jobs` to the backend on `http://localhost:3000`

So in development there are two servers.

### Docker/runtime mode

In the Docker/runtime path:

- Vite is not running as a dev server
- the frontend has already been built into static files
- Express serves those files directly

That behavior is in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts):

1. It computes `frontend/dist`
2. It checks whether that folder exists
3. It mounts `express.static(uiDistPath)`

So the same Express server handles:

- `GET /` and frontend assets like `/assets/index-...js`
- backend API routes like `/reports/weekly-summary`

That is why the Docker run only needs one application port.

## Port Mapping Explained

The next major confusion was port mapping.

The important rule is:

- left side of Docker `-p host:container` = host machine port
- right side = container internal port

### Application container

When you ran:

```bash
docker run --rm -p 8501:3000 --env-file .env steelworks
```

that meant:

- your laptop/browser used `localhost:8501`
- the app container listened internally on port `3000`

So:

- `8501` was not the frontend container port
- `8501` was the host-facing demo port
- `3000` was the Express app port inside the app container

### PostgreSQL container

Your Postgres setup was different.

The Postgres server almost certainly listened inside its own container on `5432`.
But pgAdmin was connecting from your laptop to `localhost:5433`.

That means the host-to-container DB mapping was effectively:

```text
host 5433 -> postgres container 5432
```

So the four important ports in this local setup were:

- `8501` = host-facing application port
- `3000` = internal Express application port
- `5433` = host-facing Postgres port
- `5432` = internal Postgres port

## Environment Variables: What They Actually Mean

Most of the runtime behavior comes from [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts).

### `NODE_ENV`

`NODE_ENV` controls the application mode:

- `development`
- `test`
- `production`

Important correction:

`NODE_ENV` does not automatically make Docker pick a different env file.

This repo does not have built-in logic like:

- "if production, load `.env.prod`"
- "if development, load `.env.dev`"

Instead:

- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts) loads env vars from `process.env`
- `docker run --env-file ...` decides what values are injected at runtime
- the Dockerfile only provides defaults if runtime values are not overridden

So if the Dockerfile says `NODE_ENV=production` but your `.env` says `NODE_ENV=development`, the runtime value from `.env` wins.

That is why the app logs showed:

```text
"environment":"development"
```

even inside the container.

### `PORT`

`PORT` is the Express app port.

This controls [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts), where the app calls:

```ts
app.listen(config.port, ...)
```

This has nothing to do with Postgres.

### `PGPORT`

`PGPORT` is the database port used by the `pg` driver in [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts).

This has nothing to do with the frontend or Express.

### `LOG_LEVEL` and `LOG_CONSOLE_LEVEL`

These values control logger thresholds in [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).

The severity ordering is:

- `debug`
- `info`
- `warn`
- `error`
- `silent`

So if:

```env
LOG_LEVEL=debug
LOG_CONSOLE_LEVEL=debug
```

then:

- all levels are accepted
- all levels are printed to console

### `LOG_DIR` and `LOG_FILE_NAME`

These determine the file log destination.

For example:

```env
LOG_DIR=logs
LOG_FILE_NAME=app.log
```

means logs are written to:

```text
logs/app.log
```

with rotation controlled by [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).

## How the Containers Communicate

This was the most important runtime issue.

### What went wrong first

At first, the app container used:

```env
PGHOST=localhost
```

That failed with `ECONNREFUSED`.

Why:

- inside the app container, `localhost` means the app container itself
- Postgres was not running inside that same container
- so the app tried to connect to a database server that did not exist inside itself

This produced logs like:

```text
AggregateError [ECONNREFUSED]
```

### Why `host.docker.internal` fixed the network path

After switching to:

```env
PGHOST=host.docker.internal
PGPORT=5433
```

the app container could reach the host machine's published Postgres port.

That changed the failure from:

- connection refused

to:

- password authentication failed

That was an important diagnostic improvement.

It meant:

- Docker networking was now correct
- the app was reaching the database server
- the remaining problem was credentials, not container routing

## The Exact Problems We Ran Into

### 1. Confusing host ports with container ports

At first, it was easy to mix these up:

- `8501` looked like "the frontend port"
- `3000` looked like "the backend port"
- `5433` looked like "the database port"
- `5432` looked like "the other database port"

The real mapping was:

- browser -> `localhost:8501` -> app container `3000`
- pgAdmin -> `localhost:5433` -> Postgres container `5432`

### 2. Thinking the frontend needed a second Docker server port

That is true in development, but not in the built container flow.

The reason is [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts):

- Express serves `frontend/dist`
- Express also serves the API

So the app container only exposes one application port.

### 3. Using `PGHOST=localhost` inside the app container

This caused:

- `ECONNREFUSED`

because the app container was trying to reach Postgres on itself.

### 4. Using the wrong DB credentials after the host path was fixed

Once the app reached the database host correctly, Postgres returned:

```text
password authentication failed for user "devuser"
```

This meant the current `PGUSER` and/or `PGPASSWORD` values were wrong for the database server that pgAdmin was reaching successfully.

### 5. Confusing `304 Not Modified` with backend failure

Logs like:

```text
GET / 304
GET /assets/... 304
```

were not errors.

They only meant the browser reused cached frontend assets.

The real failures were the `500` API responses and the report-service errors logged right before them.

### 6. Expecting the default week range to return seeded rows

The default week range in [src/utils/date.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/utils/date.ts) is based on the current week.

The seeded report data in [db/seed.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql) was for older weeks in early 2026.

So when the app computed a later "last 4 weeks" window, the query could legitimately return no report rows even if the database connection was working.

That was a data-window issue, not a routing bug.

## End-to-End Request Flow

This is the real production-style flow inside the app container.

### Step 1: container starts

Docker starts:

```text
node dist/index.js
```

from [Dockerfile](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/Dockerfile).

### Step 2: runtime config is loaded

[src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts):

1. loads env vars
2. validates them
3. builds the typed `config` object

### Step 3: logging is configured

[src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts):

1. calls `configureLogger(...)`
2. creates the module logger for `index`
3. logs the startup metadata

### Step 4: the PostgreSQL pool is created

[src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts):

1. builds the `pg` pool using `config.pg`
2. logs the resolved DB host and DB name
3. attaches a pool-level error handler

### Step 5: Express app is created

[src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts):

1. adds JSON parsing
2. installs request-completion logging middleware
3. mounts `/reports`
4. mounts `/jobs`
5. serves `frontend/dist` if present
6. attaches Sentry error handling
7. installs the centralized Express error handler

### Step 6: browser requests `/`

The browser hits the host port, such as:

```text
http://localhost:8501
```

Docker forwards that to the app container on port `3000`.

Express serves the built frontend files from `frontend/dist`.

### Step 7: frontend makes API requests

After the frontend loads, it requests endpoints like:

- `/reports/weekly-summary`
- `/reports/flags`

Those requests go to the same Express server.

### Step 8: routes call services, and services query Postgres

For example:

1. [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) validates query parameters and computes the default range if needed
2. it calls [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts)
3. the reporting service runs SQL through the shared pool
4. PostgreSQL returns rows or throws an error
5. the route returns JSON or falls into the error path

## How the Logs Work

The logs you saw came from multiple layers.

### Startup logs

These come from [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts):

- `Application startup`
- `HTTP server listening`

These tell you:

- which environment was active
- which port Express listened on
- whether Sentry was enabled

### Database pool logs

These come from [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts):

- `PostgreSQL pool created`
- `Unexpected PostgreSQL pool error`

These tell you:

- which DB host the app is trying to use
- whether SSL is turned on
- whether async pool-level failures happened

### HTTP request logs

These come from the middleware in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts):

- `HTTP request completed`

This middleware runs for every request and classifies severity by status code:

- `/health` with success -> `debug`
- `2xx/3xx` normal requests -> `info`
- `4xx` -> `warn`
- `5xx` -> `error`

That is why the log stream showed:

- `INFO` for `/`, CSS, and JS asset requests
- `ERROR` for `/reports/...` failures
- `WARN` for benign things like `404 /favicon.ico`

### Service logs

These come from [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts):

- `Running weekly summary query`
- `Running flag counts query`
- `Weekly summary query completed`
- `Flag counts query completed`
- `Weekly summary query failed`
- `Flag counts query failed`

These are useful because they tell you:

- the effective query range
- whether the query started at all
- whether the DB error happened before or after route validation

### Centralized request-error logs

These come from the Express error handler in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts):

- `Unhandled request error`

This log is the bridge between:

- a lower-level service/database failure
- the final HTTP `500` returned to the client

So when you saw both:

- `Weekly summary query failed`
- `Unhandled request error`

that was not duplicate logging by mistake.

It was two layers reporting the same failure from two useful perspectives:

- service-level context
- request-level context

## Reading the Real Failure Progression

The log progression tells a story.

### Phase 1: app boot is healthy

Healthy boot looked like:

- `Application startup`
- `PostgreSQL pool created`
- `Express application created`
- `HTTP server listening`

This proved the app container itself was fine.

### Phase 2: frontend serving is healthy

Healthy frontend serving looked like:

- `GET /`
- `GET /assets/...js`
- `GET /assets/...css`

This proved the built frontend was being served correctly from the app container.

### Phase 3: first database path failure

When the host was wrong, the service logs showed:

- `AggregateError [ECONNREFUSED]`

This meant:

- the app tried to connect
- no Postgres server was reachable on that target

### Phase 4: second database path failure

After fixing host/port/SSL, the failure changed to:

- `password authentication failed for user "devuser"`

This meant:

- the network path was now correct
- the database server was reachable
- the credentials were still wrong

That is an example of logs giving incremental diagnostic value.

## Practical Debugging Rules From This Analysis

1. If the app container says `host":"localhost"` for Postgres, suspect Docker networking immediately.
2. If the app container reaches `host.docker.internal` but auth fails, suspect `PGUSER` / `PGPASSWORD`.
3. If `/` and `/assets/...` load but `/reports/...` fails, the frontend serving path is healthy and the problem is in the API or database path.
4. If you see `304` for frontend assets, that is normal browser caching behavior.
5. If the default summary range returns nothing, compare the computed week range to the dates in [db/seed.sql](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql).
6. In Docker production-style runs, the frontend does not need its own exposed server port because Express serves the built frontend itself.

## Suggested Local Runtime Layout

For this specific repo, a clean mental model is:

- pgAdmin on host -> `localhost:5433`
- Postgres container internal -> `5432`
- browser on host -> `localhost:8501`
- app container internal -> `3000`
- app container to DB host route -> `host.docker.internal:5433`

That layout matches the debugging path we walked through.
