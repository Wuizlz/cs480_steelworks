# Backend Sentry Integration

This document explains how the backend Sentry integration works in this repo.

The backend side is spread across four files:

- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
- [src/sentry.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/sentry.ts)
- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)

Each file has a separate responsibility.

## File 1: `src/config.ts`

This file is where the backend learns whether a Sentry DSN exists at all.

Relevant code:

```ts
const envSchema = z.object({
  ...
  SENTRY_DSN: z.string().url().optional(),
});

export const config = {
  ...
  sentry: {
    dsn: parsed.data.SENTRY_DSN,
  },
};
```

### What this is doing

The `envSchema` section teaches the app that `SENTRY_DSN` is a valid environment variable.

Important details:

- `z.string().url()` means the value must be a valid URL when present
- `.optional()` means the app is allowed to run without Sentry enabled

That design choice matters.

If Sentry were required unconditionally:

- local development would fail immediately if `SENTRY_DSN` was blank
- every test or dev machine would be forced to provide Sentry config

Instead, the code makes Sentry optional.

That means:

- if a DSN exists, Sentry can initialize
- if it does not exist, the backend still runs normally

The exported `config.sentry.dsn` value then becomes the single trusted place the rest of the backend checks.

## File 2: `src/sentry.ts`

This file is the backend Sentry bootstrap file.

Current code:

```ts
import * as Sentry from "@sentry/node";
import { config } from "./config";

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    sendDefaultPii: true,
  });
}

export { Sentry };
```

### Why this file exists

This file separates Sentry startup from the rest of the server logic.

That is useful because:

- it keeps Sentry initialization isolated
- the rest of the backend can import one shared `Sentry` object
- startup order becomes easier to reason about

### Group 1: import the Node SDK

```ts
import * as Sentry from "@sentry/node";
```

This loads the Node Sentry SDK, which is the correct backend package for an Express server.

It is not using `@sentry/react` here because the backend does not run in a browser.

### Group 2: import validated config

```ts
import { config } from "./config";
```

This avoids reading raw environment variables directly in multiple places.

Instead of doing:

```ts
process.env.SENTRY_DSN;
```

in many files, the repo centralizes env parsing once in `config.ts`.

### Group 3: initialize only if a DSN exists

```ts
if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    sendDefaultPii: true,
  });
}
```

This is the activation gate.

What it means:

- if `config.sentry.dsn` is truthy, the Node SDK starts
- if it is missing or empty, this block does nothing

This pattern keeps the backend safe in environments where Sentry is not configured.

### About `sendDefaultPii: true`

This tells Sentry to send some default personally identifiable information when applicable, such as automatic IP-related context.

Why that setting matters:

- it can improve issue investigation by preserving more request context
- it is also a privacy and policy choice, not just a technical one

So it should be enabled only if that is acceptable for the project’s deployment environment.

### Group 4: re-export `Sentry`

```ts
export { Sentry };
```

This makes `src/sentry.ts` act like the single backend Sentry module.

Other backend files can now import from `./sentry` instead of importing `@sentry/node` and re-deciding configuration details for themselves.

## File 3: `src/index.ts`

This file is the backend entrypoint, so it has to ensure Sentry starts early.

Relevant code:

```ts
import "./sentry";
```

and:

```ts
logger.info("Application startup", {
  environment: config.environment,
  port: config.port,
  log_dir: config.logging.logDir,
  log_file: config.logging.fileName,
  sentry_enabled: Boolean(config.sentry.dsn),
});
```

### Why the side-effect import is at the top

`import "./sentry";` is a side-effect import.

That means:

- it is not importing named values for direct use
- it is importing the module so that its top-level setup code runs

The top-level setup code in `src/sentry.ts` is the `Sentry.init(...)` block.

So this import ensures the backend Sentry SDK is initialized as part of server startup.

### Why this is done early

Sentry needs to be initialized before the server is fully running.

That way:

- request-time errors can be associated with an initialized Sentry SDK
- startup-time failures are less likely to happen before Sentry exists

The startup log metadata also includes:

```ts
sentry_enabled: Boolean(config.sentry.dsn);
```

This does not activate Sentry.

It only records whether Sentry is expected to be enabled in that environment.

That is useful during debugging because the normal logs tell you whether the process started with a DSN.

## File 4: `src/app.ts`

This is where Express is connected to Sentry.

Relevant code:

```ts
import { Sentry } from "./sentry";
import { config } from "./config";
```

and later:

```ts
if (config.sentry.dsn) {
  Sentry.setupExpressErrorHandler(app);
}
```

### Why this file matters

Initializing the Node SDK alone is not enough for an Express app.

The app also needs Express-specific integration so request failures flow through Sentry’s middleware path.

### Why the error handler is placed after routes

The `setupExpressErrorHandler(app)` call appears after route registration:

```ts
app.use("/reports", createReportRouter(pool));
app.use("/jobs", createJobRouter(pool));
```

and before the project’s custom Express error handler:

```ts
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  ...
});
```

That ordering matters because Express error handlers are order-sensitive.

The intended flow is:

1. a route throws or passes an error
2. Sentry’s Express error handler sees it
3. the app’s custom error handler still logs it and returns the JSON response

So the application keeps its existing API behavior while also sending the error to Sentry.

### Relationship to the custom logger

This repo already had:

- request logging
- backend startup logging
- error logging through the custom logger

Sentry does not replace that.

Instead:

- Sentry captures and forwards the failure to the Sentry service
- the custom logger still writes local structured logs

That is why both pieces remain in `app.ts`.

## End-To-End Backend Flow

When the backend starts:

1. `src/index.ts` imports `./sentry`
2. `src/sentry.ts` checks `config.sentry.dsn`
3. if a DSN exists, `Sentry.init(...)` runs
4. `createApp(pool)` builds the Express app
5. `src/app.ts` adds `Sentry.setupExpressErrorHandler(app)` if Sentry is enabled

When an API request later fails:

1. the route error reaches Express
2. the Sentry Express handler can observe it
3. the repo’s own error middleware still logs the failure and returns `500`

That is the complete backend wiring path.
