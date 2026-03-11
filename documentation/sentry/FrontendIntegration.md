# Frontend Sentry Integration

This document explains how the React side of the Sentry integration works.

The frontend side is spread across these files:

- [frontend/src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/sentry.ts)
- [frontend/src/vite-env.d.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/vite-env.d.ts)
- [frontend/src/main.tsx](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/frontend/src/main.tsx)
- [.env.example](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/.env.example)

Each one solves a different part of the problem.

## File 1: `frontend/src/sentry.ts`

Current code:

```ts
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
  });
}

export { Sentry };
```

### Why this file exists

This is the frontend equivalent of the backend `src/sentry.ts` bootstrap file.

It keeps browser Sentry initialization in one place instead of scattering it across the entrypoint.

### Group 1: import the React SDK

```ts
import * as Sentry from "@sentry/react";
```

This is the correct frontend package because the UI is a React application.

It is not using `@sentry/node` here because the browser is not a Node runtime.

### Group 2: read the DSN through `import.meta.env`

```ts
if (import.meta.env.VITE_SENTRY_DSN) {
  ...
}
```

In Vite, frontend environment variables are exposed through `import.meta.env`.

That is why the frontend cannot use:

```ts
process.env.SENTRY_DSN;
```

like the backend does.

It also explains why the variable name must start with `VITE_`.

Without that prefix, Vite will not expose it to client-side code.

### Group 3: initialize the browser SDK only when configured

```ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true,
});
```

This runs only if the DSN exists.

That means:

- local environments without a frontend DSN still work
- the UI does not crash just because Sentry is not configured

### Group 4: export the initialized module

```ts
export { Sentry };
```

This allows the entrypoint to import from `./sentry` instead of importing from `@sentry/react` directly and re-deciding configuration there.

## File 2: `frontend/src/vite-env.d.ts`

Current code:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Why this file exists

This file teaches TypeScript about the custom Vite environment variable.

Without it, TypeScript may complain that:

- `import.meta.env` does not have a `VITE_SENTRY_DSN` property

This is a type-level support file, not a runtime file.

That means:

- it does not initialize Sentry
- it does not generate the env variable
- it only tells the TypeScript compiler that this property is expected

### Group 1: Vite client type reference

```ts
/// <reference types="vite/client" />
```

This loads the standard Vite client-side typing definitions.

### Group 2: extend `ImportMetaEnv`

```ts
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
}
```

This adds the custom env variable to the known Vite env shape.

Important detail:

- it is marked optional with `?`

That matches the actual runtime design where Sentry is allowed to be absent.

## File 3: `frontend/src/main.tsx`

Current Sentry-related code:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Sentry } from "./sentry";
import App from "./App";
import "./styles.css";

function SentryFallback(): JSX.Element {
  return <div>Something went wrong.</div>;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found in index.html");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={SentryFallback}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
```

### Why this file matters

This is the frontend entrypoint.

That means it is the correct place to:

- import the browser Sentry bootstrap
- wrap the React application with Sentry protection

### Group 1: import `Sentry` from the local bootstrap module

```ts
import { Sentry } from "./sentry";
```

This ensures the `frontend/src/sentry.ts` module runs before the app is rendered.

That way, the SDK is initialized before the root application tree mounts.

### Group 2: fallback UI component

```tsx
function SentryFallback(): JSX.Element {
  return <div>Something went wrong.</div>;
}
```

This provides the UI that will be shown if the error boundary catches a rendering failure in the wrapped React tree.

Why this exists:

- without a fallback, the user could end up with a broken UI and no clear visible state
- with a fallback, the app fails more gracefully while the error is still captured

### Group 3: use the real DOM root for this repo

```ts
const rootElement = document.getElementById("root");
```

This is important because the Sentry docs example often shows generic mount examples, but this repo specifically uses `#root`.

So the integration had to match this project’s actual frontend structure, not a generic snippet.

### Group 4: wrap `<App />` in `Sentry.ErrorBoundary`

```tsx
<Sentry.ErrorBoundary fallback={SentryFallback}>
  <App />
</Sentry.ErrorBoundary>
```

This is the main React-side protection mechanism added for Sentry.

What it does:

- it wraps the application tree
- if a render-time React error happens inside that tree, the boundary can catch it
- Sentry can record the failure
- the fallback UI is rendered instead of leaving the page in a broken state

This does not mean every possible frontend issue becomes a boundary catch.

For example:

- some event-handler problems and non-React runtime failures may behave differently

But it does add a strong layer of render-path error capture around the main app tree.

## File 4: `.env.example`

Relevant lines:

```env
SENTRY_DSN=
VITE_SENTRY_DSN=
```

### Why this file was updated

`.env.example` documents what configuration the project expects.

Adding these keys here helps future developers because it makes Sentry discoverable without needing to inspect code first.

It also reinforces the two-runtime design:

- one variable for the backend
- one variable for the frontend

## End-To-End Frontend Flow

When the frontend starts:

1. `frontend/src/main.tsx` imports `./sentry`
2. `frontend/src/sentry.ts` checks `import.meta.env.VITE_SENTRY_DSN`
3. if a DSN exists, `Sentry.init(...)` runs
4. the React app is mounted inside `Sentry.ErrorBoundary`

When a render failure happens inside the wrapped app tree:

1. the error boundary can catch it
2. Sentry can record the error
3. the fallback UI is shown

That is the complete frontend wiring path.
