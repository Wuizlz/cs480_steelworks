# Documentation Guide

This folder is organized by feature area rather than by file type.

The goal is to help a new developer answer two questions quickly:

1. Which runtime path am I trying to understand?
2. Which source files participate in that path?

## Folder Map

- [build/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/build/README.md)
  Build outputs, Docker packaging, and where backend/frontend artifacts are produced.
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
- If the question is "Why does the frontend use Vite instead of plain `tsc`?" start in [frontend/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/README.md).
- If the question is "What does `npm test` actually exercise?" start in [testing/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/testing/README.md).
- If the question is "Where did this log line come from?" start in [logging-integrations/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/README.md) and [logging/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/README.md).
- If the question is "Why did this frontend/backend error reach Sentry?" start in [sentry/README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/sentry/README.md).
