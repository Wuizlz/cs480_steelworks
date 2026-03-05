# Playwright E2E Testing

This document explains how Playwright is installed, how it is configured in this repo, how the E2E tests run, and how CI executes them.

## Installation

We use the Node/TypeScript Playwright runner (`@playwright/test`).

Install the dependency:

```bash
npm install -D @playwright/test
```

Install browser binaries:

```bash
npx playwright install
```

Notes:

- `@playwright/test` provides the test runner and CLI.
- `npx playwright install` downloads Chromium/Firefox/WebKit binaries used by the tests.

## Configuration (`playwright.config.ts`)

File: `playwright.config.ts`

Key behaviors:

- `testDir: "e2e"` tells Playwright to look in the `e2e/` folder for tests.
- `use.baseURL` defaults to `http://localhost:5173` so tests can call `page.goto("/")`.
- `use.trace` is set to `on-first-retry` to help debug failures.
- `projects` runs Chromium by default.
- `webServer` starts both backend and frontend automatically for test runs.
- `slowMo` is configurable via `PW_SLOWMO` for local debugging.

The `webServer` block does two things:

- Starts the API with `npm run dev` and waits for `http://localhost:3000/health`.
- Starts the UI with `npm run dev:ui` and waits for `http://localhost:5173`.

In CI, `reuseExistingServer` is `false`, so Playwright always starts fresh servers. Locally, it can reuse existing servers if they’re already running.

## E2E Tests

File: `e2e/weekly-reporting.spec.ts`

What it covers:

- **Weekly Summary** workflow:
  - Loads the UI.
  - Runs a summary query for a seeded date range.
  - Clicks a row to trigger the drill-down.
  - Confirms a detail row appears.
- **Flagged Records** workflow:
  - Loads the UI.
  - Queries flagged records for the same date range.
  - Confirms expected flag types appear.

The tests assume the database was seeded using `db/schema.sql` + `db/seed.sql`.

## Commands

Headless E2E (default):

```bash
npx playwright test e2e
```

Headed E2E (visible browser):

```bash
npx playwright test e2e --headed
```

Headed with slow motion (3s per action):

```bash
PW_SLOWMO=3000 npx playwright test e2e --headed
```

Unit tests:

```bash
npm test
```

All tests (unit + E2E):

```bash
npm test && npx playwright test e2e
```

## GitHub Actions (CI)

File: `.github/workflows/ci.yml`

What was added:

- A **Postgres service** for tests:
  - Database: `ops_test`
  - User: `postgres`
  - Password: `postgres`
- A step to **install Playwright browsers**:
  - `npx playwright install --with-deps`
- A step to **seed the test database**:
  - Runs `db/schema.sql` and `db/seed.sql` using `psql`
- A step to **run E2E tests**:
  - `npx playwright test e2e`
  - Environment variables (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) point the API to the CI Postgres service

How it works together:

- CI starts Postgres and seeds it.
- Playwright’s `webServer` in `playwright.config.ts` starts the API and UI.
- E2E tests run against the running servers and seeded data.

## Local Test DB Usage

If you use a local Docker DB for E2E, make sure:

- The DB is seeded with `db/schema.sql` and `db/seed.sql`.
- The API process reads `.env.test` (or a test config) that points to that DB.
- The UI and API are running before tests, or let Playwright start them via `webServer`.
