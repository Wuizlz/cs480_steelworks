# Frontend Documentation

This folder explains how the browser app starts, how the UI talks to the backend, and why Vite owns the frontend build output.

## Document Map

- [FrontendArchitectureAndTooling.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/frontend/FrontendArchitectureAndTooling.md)
  Explains the frontend folder structure, Vite/TypeScript responsibilities, and UI data flow.

## Source File Map

- [frontend/index.html](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/index.html)
  Browser entry HTML with the `#root` mount point.
- [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
  Bootstraps React, initializes the Sentry boundary, and mounts the app.
- [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx)
  Main UI component that fetches report data and updates state.
- [frontend/src/types.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/types.ts)
  Shared TypeScript shapes for frontend API responses.
- [frontend/src/styles.css](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/styles.css)
  Global styles and layout.
- [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts)
  Initializes the browser Sentry SDK.
- [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts)
  Configures dev proxying and production output.
- [frontend/tsconfig.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/tsconfig.json)
  Type rules for frontend code, with `noEmit: true`.

## Example Workflow: Load Weekly Summary In Dev

This is the most common frontend path.

1. `npm run dev:ui` starts Vite from [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json).
2. The browser opens [frontend/index.html](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/index.html), which loads `src/main.tsx`.
3. [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx) imports [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts), creates the React root, and renders `<App />` inside `Sentry.ErrorBoundary`.
4. [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx) calls `loadSummary(...)`, which uses `fetchJson(...)` to request `/reports/weekly-summary`.
5. [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts) proxies `/reports` to `http://localhost:3000` during development.
6. The backend responds with JSON, and [frontend/src/App.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/App.tsx) stores the rows in React state and renders the table.

## Example Workflow: Production Frontend Build

1. `npm run build:ui` runs Vite from [package.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/package.json).
2. [frontend/tsconfig.json](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/tsconfig.json) provides type-checking rules, but it does not emit `.js` files.
3. [frontend/vite.config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/vite.config.ts) bundles the app and writes output into `frontend/dist`.
4. [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) serves that built folder in production.
