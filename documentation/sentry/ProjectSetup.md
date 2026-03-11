# Sentry Project Setup

This document explains the initial setup steps we took before any code changes were made.

The important idea is that Sentry had to be set up as two separate projects because this repo has two separate runtimes:

- a React frontend
- an Express backend

## Step 1: Create The Frontend Sentry Project

In Sentry, the frontend project should be created with the React platform.

Why React was the correct choice:

- the UI is a React application
- it is mounted from [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
- runtime errors in this part of the app happen in the browser, not in Node

The resulting frontend DSN is meant for the browser app only.

It belongs in:

```env
VITE_SENTRY_DSN=...
```

## Step 2: Create The Backend Sentry Project

In Sentry, the backend project should be created with the Express or Node.js platform.

Why Express or Node.js was the correct choice:

- the backend entrypoint is [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- the HTTP app is built in [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
- this side of the system runs in a Node process and handles API requests

The resulting backend DSN is meant for the server only.

It belongs in:

```env
SENTRY_DSN=...
```

## Step 3: Store Each DSN In The Correct Environment Variable

This repo now supports these two variables:

```env
SENTRY_DSN=
VITE_SENTRY_DSN=
```

These were added to [.env.example](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.env.example).

Why there are two variables instead of one:

- the backend reads `SENTRY_DSN` through `process.env`
- the frontend reads `VITE_SENTRY_DSN` through `import.meta.env`

The `VITE_` prefix matters because Vite only exposes environment variables to browser code if they start with `VITE_`.

Without that prefix:

- the frontend would not see the variable
- the React Sentry setup would have no DSN at runtime

## Step 4: Create A Local `.env`

This repo expects local runtime values in `.env`.

That expectation is documented in [README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/README.md) and backed by the `dotenv.config()` call inside [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts).

The normal workflow is:

1. copy `.env.example` to `.env`
2. fill in real values
3. restart the server or redeploy

Important detail:

- `.env` is gitignored
- `.env.example` is tracked

That means the example file documents what variables exist, while the real `.env` stays local and private.

## Step 5: Install The SDK Packages

This repo uses two Sentry SDKs:

- `@sentry/react`
- `@sentry/node`

Why both are needed:

- `@sentry/react` handles browser-side React errors
- `@sentry/node` handles backend server errors and Express integration

If only one package were installed:

- frontend-only setup would miss backend failures
- backend-only setup would miss browser failures

## Step 6: Wire The Code To The Environment Variables

After the Sentry projects and DSNs existed, the codebase had to be wired in two different places:

- backend startup and Express error handling
- frontend startup and React render protection

That is why Sentry required both new files and updates to existing files.

### New files created

- [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts)
- [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts)
- [frontend/src/vite-env.d.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/vite-env.d.ts)

### Existing files updated

- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
- [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
- [.env.example](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.env.example)
- [README.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/README.md)

## Step 7: Restart After Env Changes

Sentry DSNs are read at runtime.

That means changing `.env` alone is not enough if the process is already running.

You must:

- restart the backend process
- restart the frontend dev server, or rebuild and redeploy the frontend

Otherwise the running app still uses the old environment snapshot.

## Practical Summary

The setup sequence was:

1. create a React Sentry project
2. create an Express Sentry project
3. place each DSN in the correct env variable
4. add code on the backend to initialize the Node SDK and attach the Express handler
5. add code on the frontend to initialize the React SDK and wrap the app with an error boundary
6. restart the app so the new env values are loaded
