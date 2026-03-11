# Continuous Integration and Pre-Commit Checks

This document explains the local pre-commit workflow and the GitHub Actions pipeline that runs on pull requests.

The important distinction is that local pre-commit and CI overlap, but CI does more than local pre-commit.

## Overview

We use two related quality gates:

- Local pre-commit runs `npm run license:check` and `npm run precommit:check`.
- GitHub Actions runs reproducible dependency install, seeded database setup, backend quality checks, and full Playwright E2E tests.

That means CI is not just re-running formatting and unit tests. It also verifies that the app can start and behave correctly in a browser against a real Postgres database.

## Local Pre-Commit Workflow (Husky)

### Where it lives

- Hook file: `.husky/pre-commit`
- Script definitions: `package.json`

### What the hook runs

The hook executes these commands in order:

1. `npm run license:check`
2. `npm run precommit:check`

If any command exits with a non-zero status, the commit is blocked.

### What each script means

#### `license:check`

Command:

```bash
license-checker --production --summary | grep -Ei 'gpl|agpl|lgpl' && (echo "Copyleft license detected" && exit 1) || exit 0
```

Behavior:

1. `license-checker --production --summary` lists runtime dependency licenses.
2. `grep -Ei 'gpl|agpl|lgpl'` looks for copyleft licenses.
3. If one is found, the script exits with failure.
4. If none are found, the script exits successfully.

#### `precommit:check`

Command:

```bash
prettier . --check && eslint . --ext .ts,.tsx && tsc --noEmit && jest --coverage
```

Behavior:

1. Prettier verifies formatting.
2. ESLint checks lint rules.
3. TypeScript performs a no-emit type check.
4. Jest runs backend tests and collects coverage.

Any failure stops the commit.

## GitHub Actions (CI)

### Workflow location

- `.github/workflows/ci.yml`

### When it runs

- On pull request events: `opened`, `synchronize`, `reopened`

### What the workflow is actually doing

The CI workflow is not building Docker and it is not merely checking whether the backend health endpoint responds.

It currently does all of the following:

1. Starts a PostgreSQL service container inside GitHub Actions.
2. Checks out the repository.
3. Sets up Node.js 20 and npm caching.
4. Installs dependencies with `npm ci`.
5. Installs Playwright browser binaries and OS dependencies.
6. Seeds the CI database using `db/schema.sql` and `db/seed.sql`.
7. Runs `npm run precommit:check`.
8. Runs Playwright E2E tests, which start the backend and frontend servers and exercise the app in a real browser.

So CI is validating:

- the lockfile-based dependency install
- backend and frontend type correctness
- formatting and lint rules
- Jest test behavior
- compatibility with a real Postgres schema and seed data
- backend startup for E2E
- frontend startup for E2E
- real user-facing browser flows

It does **not** currently:

- run `docker build`
- create a Docker image
- run a Docker container
- deploy the app anywhere

## What `npm ci` means in CI

The workflow uses:

```bash
npm ci
```

This does not create an image and it does not simply "CI the lockfile."

What it actually does:

1. Uses [`package-lock.json`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package-lock.json) as the dependency source of truth.
2. Installs the exact versions pinned in the lockfile.
3. Fails if [`package.json`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json) and the lockfile are inconsistent.
4. Produces a clean, reproducible dependency install for the runner.

That is why CI installs dependencies this way instead of using `npm install`.

## Step-by-Step CI Analysis

### 1. PostgreSQL service container

The workflow starts Postgres 15 as a service container.

Purpose:

- provide a real database for E2E testing
- avoid depending on an external shared database
- keep CI deterministic

The workflow uses `pg_isready` as a health check so later steps do not try to seed or query the database before it is ready.

### 2. Repository checkout

`actions/checkout@v4` pulls the repository contents into the runner.

Without this step, the workflow would not have:

- source code
- SQL seed files
- config files
- npm scripts

### 3. Node setup

`actions/setup-node@v4` installs Node 20 and enables npm caching.

Purpose:

- pin the Node runtime used in CI
- reduce install time on later workflow runs

### 4. Dependency installation

The workflow runs:

```bash
npm ci
```

This installs everything needed for the job, including:

- backend runtime packages
- frontend runtime packages
- TypeScript
- ESLint
- Jest
- Playwright

### 5. Playwright browser installation

The workflow runs:

```bash
npx playwright install --with-deps
```

Purpose:

- install the Chromium browser used by Playwright
- install required system-level packages so the browser can launch

Without this step, the E2E tests could fail before the app code is even exercised.

### 6. Database seeding

The workflow installs `postgresql-client` and then runs:

- `db/schema.sql`
- `db/seed.sql`

Purpose:

- create the schema expected by the backend
- insert deterministic data for the E2E suite

This is different from the Jest setup:

- Jest reporting tests use `pg-mem`
- CI Playwright tests use real Postgres

### 7. Pre-commit checks

The workflow runs:

```bash
npm run precommit:check
```

That script comes from [`package.json`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json) and currently runs:

```bash
prettier . --check && eslint . --ext .ts,.tsx && tsc --noEmit && jest --coverage
```

This means CI verifies:

- formatting
- linting
- TypeScript checks
- backend Jest tests
- coverage output

If any of these fail, the workflow stops before the browser tests.

### 8. Playwright E2E tests

The workflow then runs:

```bash
npx playwright test e2e
```

This step does not just wait for the backend health endpoint and then pass.

Instead, [`playwright.config.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/playwright.config.ts) starts two real servers:

- `npm run dev` for the backend and waits for `http://localhost:3000/health`
- `npm run dev:ui` for the frontend and waits for `http://localhost:5173`

Those URLs are readiness checks only.

Once both servers are ready, Playwright opens a browser and runs real E2E specs from [`e2e/weekly-reporting.spec.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/e2e/weekly-reporting.spec.ts).

That means CI is validating the full path:

browser -> frontend -> backend routes -> services -> Postgres

So a passing E2E step means more than "the server started."

It means:

- the backend booted successfully
- the frontend booted successfully
- the browser could load the UI
- the UI could call the backend
- the backend could query the seeded database
- the expected workflows produced the expected UI result

## Concrete Example: Weekly Summary Flow In CI

For the weekly summary flow, the CI path looks like this:

1. Playwright starts the backend dev server.
2. Playwright starts the frontend dev server.
3. The browser loads the frontend.
4. The test triggers the weekly summary workflow in the UI.
5. The frontend sends a request to `/reports/weekly-summary`.
6. [`src/routes/reportRoutes.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) validates the request.
7. [`src/services/reportService.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts) runs SQL from [`src/db/queries.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/queries.ts) against the seeded Postgres instance.
8. The backend returns JSON.
9. The frontend renders the returned rows.
10. Playwright asserts that the expected UI content is present.

That is why the E2E step is meaningful. It is exercising a real feature path, not just a process startup check.

## What CI Does Not Currently Prove

Even though the CI workflow is useful, it still leaves some things out.

It does not currently verify:

- Docker image build success
- Docker runtime behavior
- production startup through `node dist/index.js`
- production serving of `frontend/dist`

Those are separate concerns from the current PR workflow.

## GitHub Security Configuration

Enable these features in GitHub to keep dependencies and code scanning up to date.

### Dependabot

1. GitHub -> **Security** -> **Dependabot**: enable it.
2. GitHub -> **Settings** -> **Advanced Security**: enable:
   - Dependabot alerts
   - Dependabot security updates
   - Grouped security updates

### Common vulnerabilities to watch for

- SQL Injection
- Path Traversal
- Insecure File Handling

### Code Scanning (CodeQL)

1. GitHub -> **Security** -> **Enable code scanning**
2. GitHub -> **Settings** -> **Advanced Security** -> **Code Scanning**
3. Choose the default CodeQL setup

## How to Verify

Local verification:

```bash
npm run license:check
npm run precommit:check
npx playwright test e2e
```

CI verification:

1. Open a pull request.
2. Check the PR Checks tab or the Actions tab.
3. Confirm that:
   - the pre-commit checks step passed
   - the E2E tests step passed

## Key Files

- [`.github/workflows/ci.yml`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.github/workflows/ci.yml)
- [`.husky/pre-commit`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.husky/pre-commit)
- [`package.json`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json)
- [`playwright.config.ts`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/playwright.config.ts)
- [`db/schema.sql`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/schema.sql)
- [`db/seed.sql`](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/db/seed.sql)
