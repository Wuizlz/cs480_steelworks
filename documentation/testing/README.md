# Testing Documentation

This folder explains how automated checks run in this repo, what they execute, and which source files they touch.

## Document Map

- [BackendTestingGuide.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/BackendTestingGuide.md)
  Explains the Jest-backed backend tests and the in-memory database setup.
- [ContinuousIntegrationAndPreCommit.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/ContinuousIntegrationAndPreCommit.md)
  Explains pre-commit checks and CI behavior.
- [EndToEndTestingWithPlaywright.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/EndToEndTestingWithPlaywright.md)
  Explains Playwright config and browser-driven testing.

## Source File Map

- [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json)
  Defines `test` and `precommit:check`.
- [jest.config.js](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/jest.config.js)
  Controls Jest test discovery and TypeScript transformation.
- [jest.transform.cjs](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/jest.transform.cjs)
  Transforms TypeScript for Jest.
- [tests/helpers.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/helpers.ts)
  Builds the in-memory database used by backend tests.
- [tests/reporting.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/reporting.test.ts)
  Verifies reporting behavior against seeded data.
- [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts)
  Verifies logger formatting and file rotation.
- [playwright.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/playwright.config.ts)
  Starts backend and frontend servers for E2E tests.
- [e2e/weekly-reporting.spec.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/e2e/weekly-reporting.spec.ts)
  Browser-level workflow coverage.

## Example Workflow: `npm test`

This is the main backend/unit verification path.

1. `npm test` maps to Jest in [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json).
2. [jest.config.js](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/jest.config.js) finds `tests/**/*.test.ts` and transforms them through [jest.transform.cjs](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/jest.transform.cjs).
3. [tests/reporting.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/reporting.test.ts) creates an in-memory Postgres-compatible pool through [tests/helpers.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/helpers.ts).
4. That test calls service functions in [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts) directly.
5. [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts) still uses the logger, so service-level logging paths are exercised even though Express routes are not involved.
6. [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts) separately configures the logger engine directly and verifies file output/rotation in a temp directory.

Important distinction:

- reporting tests cover service + SQL behavior
- logger tests cover the logger engine itself
- neither of those tests is a browser workflow

## Example Workflow: `npx playwright test e2e`

1. [playwright.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/playwright.config.ts) starts the backend and frontend dev servers.
2. [e2e/weekly-reporting.spec.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/e2e/weekly-reporting.spec.ts) opens the browser UI.
3. The frontend submits real HTTP requests to the backend.
4. This exercises the full app path: browser -> frontend -> backend routes -> services -> database.
