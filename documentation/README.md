# Documentation Guide

This folder is organized by feature area rather than by file type.

The goal is to help a new developer answer two questions quickly:

1. Which runtime path am I trying to understand?
2. Which source files participate in that path?

## Recommended Reading Order

If you are new to the repo, read the docs in this order:

1. [FullBreakDown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/FullBreakDown.md)
   Start here for the end-to-end production and local-development picture: Render, Docker, PostgreSQL, pgAdmin, frontend-to-backend flow, logs, Sentry, CI, hooks, and uptime monitoring.
2. [build/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/README.md)
   Start here to understand how the repo becomes a runnable app, where `dist/` and `frontend/dist/` come from, and how Docker packages both sides.
3. [build/TestDevContainerAnalysis.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/TestDevContainerAnalysis.md)
   Read this next for the concrete runtime picture: app container, Postgres container, host ports, env files, and the exact debugging issues we hit.
4. [frontend/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/README.md)
   This explains how the browser app boots, why Vite owns frontend output, and how the UI talks to the backend in dev and production-style runs.
5. [logging/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/README.md)
   Read this before troubleshooting logs so you understand logger startup, levels, console/file output, and where logger behavior is configured.
6. [logging-integrations/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/README.md)
   Then read this to map actual log lines back to routes, services, and database wiring.
7. [testing/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/README.md)
   This shows what `npm test`, `npm run precommit:check`, CI, and Playwright actually exercise.
8. [sentry/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/README.md)
   Read this last once the runtime and logging story is clear, because Sentry is layered on top of those paths.

## Concise Context

The shortest accurate mental model for this repo is:

- backend source lives in `src/` and compiles to `dist/`
- frontend source lives in `frontend/src/` and Vite builds it to `frontend/dist/`
- in development, Vite and Express run as separate servers
- in Docker and production-style runs, Express serves both the API and the built frontend
- PostgreSQL is external to the app process, so env values like `PGHOST` and `PGPORT` decide whether the app can reach the database at all
- the logger tells you what the app is doing locally, while Sentry is for captured runtime failures

## Folder Map

- [FullBreakDown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/FullBreakDown.md)
  One end-to-end reference for production Render hosting, local Docker/dev workflows, frontend/backend/DB communication, logging, Sentry, CI, hooks, and uptime monitoring.
- [build/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/README.md)
  Build outputs, Docker packaging, and where backend/frontend artifacts are produced.
  Includes a detailed local container analysis for app-to-Postgres communication and debugging.
- [frontend/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/README.md)
  Frontend entrypoint, Vite, TypeScript, UI data flow, and browser/runtime behavior.
- [testing/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/README.md)
  Jest, Playwright, pre-commit checks, and how tests map to real code paths.
- [logging/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/README.md)
  Backend logger startup, logger engine behavior, and logger-focused tests.
- [logging-integrations/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/README.md)
  Where logging is called throughout routes, services, and database wiring.
- [sentry/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/README.md)
  Frontend and backend Sentry setup, initialization order, and error capture flow.

## How To Use This Folder

Start with the folder README for the feature you care about.

Then open the deeper file-level documents only after you know which part of the workflow you actually need.

Examples:

- If the question is "Why did `npm run build` create these files?" start in [build/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/README.md).
- If the question is "I need the shortest path to understand the whole repo," start with [FullBreakDown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/FullBreakDown.md) and then follow the `Recommended Reading Order`.
- If the question is "Why does the frontend use Vite instead of plain `tsc`?" start in [frontend/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/README.md).
- If the question is "What does `npm test` actually exercise?" start in [testing/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/README.md).
- If the question is "Where did this log line come from?" start in [logging-integrations/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/README.md) and [logging/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/README.md).
- If the question is "Why did this frontend/backend error reach Sentry?" start in [sentry/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/README.md).
