# Sentry Documentation

This folder explains how Sentry was added to this project, why it is split into a frontend project and a backend project, and which files were created or updated so the integration works end to end.

## Document Map

- [ProjectSetup.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/ProjectSetup.md)
  Explains the initial Sentry dashboard setup steps, the two-project split, and the environment variables required to activate each side.
- [BackendIntegration.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/BackendIntegration.md)
  Explains the Express and Node side of the integration, including config loading, SDK initialization, app startup order, and Express error handling.
- [FrontendIntegration.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/FrontendIntegration.md)
  Explains the React side of the integration, including browser SDK initialization, Vite env typing, and the `ErrorBoundary` wrapper in the frontend entrypoint.

## Why There Are Two Sentry Projects

Sentry is split by runtime in this codebase:

- The browser app runs React code in the user’s browser.
- The API runs Node and Express code on the server.

Those are two different execution environments, so they should not share one Sentry project.

Using two Sentry projects gives you cleaner error ownership:

- frontend issues go to the React project
- backend issues go to the Express project

That is why this repo uses:

- `VITE_SENTRY_DSN` for the frontend
- `SENTRY_DSN` for the backend

## File Inventory

The Sentry feature is spread across these files:

### New files created for Sentry

- [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts)
- [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts)
- [frontend/src/vite-env.d.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/vite-env.d.ts)

### Existing files updated so Sentry can work

- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
- [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
- [.env.example](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.env.example)
- [README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/README.md)

## High-Level Flow

At a high level, the integration works like this:

1. Create one Sentry project for React and one for Express.
2. Copy each project’s DSN into the correct environment variable.
3. Load the backend DSN through [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts).
4. Initialize the Node SDK early through [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts) and [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts).
5. Attach the Express Sentry error handler in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts).
6. Initialize the React SDK in [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts).
7. Wrap the React app in [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx) with `Sentry.ErrorBoundary`.

## Example Workflow: Frontend Render Failure

1. The browser loads [frontend/index.html](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/index.html).
2. [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx) imports [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts) before creating the React tree.
3. If `VITE_SENTRY_DSN` exists, [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts) initializes the browser SDK.
4. [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx) renders `<App />` inside `Sentry.ErrorBoundary`.
5. If the wrapped React tree throws during render or update, the boundary shows the fallback UI and Sentry can record the event.

Important distinction:

- the React boundary handles render-path React failures inside the mounted tree
- very early bootstrap errors can still reach Sentry through browser-global handlers if Sentry was initialized first

## Example Workflow: Backend Request Failure

1. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) imports [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts) before starting the server.
2. If `SENTRY_DSN` exists, [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts) initializes the Node SDK.
3. [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) registers the Express Sentry error handler.
4. A route or service throws.
5. Express passes the failure through the error path, where Sentry can capture it and the app logger also records server-side details.

## What Sentry Does In This Repo

Sentry does not replace the custom logger.

The logger and Sentry have different jobs:

- the custom logger writes structured local logs for startup, requests, reporting, and ingest flows
- Sentry sends captured runtime failures to the Sentry dashboard for alerting and investigation

So the logging feature stays in place, and Sentry is added on top of it.
