# Understanding `src/app.ts`

This document explains how [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) integrates logging into the Express application.

If `src/index.ts` initializes logging and `src/logging/logger.ts` implements it,
`src/app.ts` is where logging becomes part of request handling.

## Why This File Matters for Logging

This file is responsible for:

- creating logger instances for the Express layer
- logging request outcomes
- logging uncaught request errors
- attaching route modules that also use the logger

This is where backend HTTP traffic becomes visible in the logs.

## Full Code

```ts
/**
 * Express application factory.
 *
 * The app is created with explicit dependencies to enable testing
 * with alternate database pools (e.g., pg-mem).
 */

import express, { Application, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { getLogger, toErrorMeta } from "./logging/logger";
import { createJobRouter } from "./routes/jobRoutes";
import { createReportRouter } from "./routes/reportRoutes";

const appLogger = getLogger("app");
const httpLogger = getLogger("http");

export function createApp(pool: Pool): Application {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const pathName = req.originalUrl || req.url;
      const meta = {
        method: req.method,
        path: pathName,
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(1)),
      };

      if (pathName === "/health" && res.statusCode < 400) {
        httpLogger.debug("HTTP request completed", meta);
        return;
      }

      if (res.statusCode >= 500) {
        httpLogger.error("HTTP request completed", meta);
        return;
      }

      if (res.statusCode >= 400) {
        httpLogger.warn("HTTP request completed", meta);
        return;
      }

      httpLogger.info("HTTP request completed", meta);
    });

    next();
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/reports", createReportRouter(pool));
  app.use("/jobs", createJobRouter(pool));

  const uiDistPath = path.join(process.cwd(), "frontend", "dist");

  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
  }

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    appLogger.error("Unhandled request error", {
      method: req.method,
      path: req.originalUrl || req.url,
      ...toErrorMeta(err),
    });

    res.status(500).json({ error: "Internal server error" });
  });

  appLogger.info("Express application created", {
    serves_frontend: fs.existsSync(uiDistPath),
  });

  return app;
}
```

## Section 1: Module Loggers

```ts
const appLogger = getLogger("app");
const httpLogger = getLogger("http");
```

This file uses two separate logger identities.

Why split them:

- `appLogger` is for application-level lifecycle or error events
- `httpLogger` is for request-level traffic

That separation helps when reading logs.

Examples:

- `app` log entries tell you about application setup or uncaught Express errors
- `http` log entries tell you about request method, path, status, and duration

## Section 2: Request Logging Middleware

```ts
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    ...
  });

  next();
});
```

This middleware is the main request-logging hook.

Why it is placed near the top:

- it sees almost every request
- it can measure the full request duration
- it runs before route handlers complete

### Why it records `startedAt`

```ts
const startedAt = process.hrtime.bigint();
```

This captures a high-resolution timestamp at the start of the request.

Later, when the response finishes, the code subtracts the two values to compute
latency in milliseconds.

This is more precise than using `Date.now()`.

## Section 3: Why `res.on("finish", ...)` Is Used

```ts
res.on("finish", () => {
  ...
});
```

This means:

- do not log at request start
- wait until the response is actually finished

Why this is better:

- the status code is known
- the total duration is known
- the app knows whether the request succeeded or failed

If the logger fired too early, those values would be incomplete.

## Section 4: The Request Metadata Object

```ts
const meta = {
  method: req.method,
  path: pathName,
  status_code: res.statusCode,
  duration_ms: Number(durationMs.toFixed(1)),
};
```

This object is what gets attached to the request log entry.

Why these fields matter:

- `method` tells you what kind of request it was
- `path` tells you which endpoint was hit
- `status_code` tells you the outcome class
- `duration_ms` tells you performance cost

This is the minimum useful shape for HTTP access logging.

## Section 5: Status-Based Log Levels

The request logger does not write every request at the same severity.

### Health checks

```ts
if (pathName === "/health" && res.statusCode < 400) {
  httpLogger.debug("HTTP request completed", meta);
  return;
}
```

Health checks are intentionally downgraded to `debug`.

Why:

- health endpoints can be called very frequently
- logging every one at `info` can create noise

So the code still records them, but only at the lowest normal severity.

### Server failures

```ts
if (res.statusCode >= 500) {
  httpLogger.error("HTTP request completed", meta);
  return;
}
```

Any `5xx` response is logged as an error.

Why:

- it indicates a server-side failure
- it usually deserves attention

### Client or validation failures

```ts
if (res.statusCode >= 400) {
  httpLogger.warn("HTTP request completed", meta);
  return;
}
```

Any `4xx` response is logged as a warning.

Why:

- the server stayed up
- but something unusual or rejected happened

### Normal successful requests

```ts
httpLogger.info("HTTP request completed", meta);
```

Successful non-health requests are logged at `info`.

This gives normal operational visibility without marking them as warnings or errors.

## Section 6: Error Logging Middleware

```ts
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  appLogger.error("Unhandled request error", {
    method: req.method,
    path: req.originalUrl || req.url,
    ...toErrorMeta(err),
  });

  res.status(500).json({ error: "Internal server error" });
});
```

This is the Express error handler.

Why it matters for logging:

- route/service errors are turned into structured error logs
- logs include both request context and error context

### Why `toErrorMeta(err)` is used

This expands the error into:

- `error_name`
- `error_message`
- `error_stack`

So the log is far more useful than a plain message.

### Why the response stays generic

The log keeps full diagnostic detail, but the API response returns:

```json
{ "error": "Internal server error" }
```

That is good separation:

- internal detail stays in logs
- clients get a stable safe message

## Section 7: Application Creation Log

```ts
appLogger.info("Express application created", {
  serves_frontend: fs.existsSync(uiDistPath),
});
```

This is a small lifecycle log for the Express layer.

What it records:

- whether the frontend build exists and will be served statically

This is useful during startup because it tells you whether the API is also
serving the production UI.

## Final Mental Model

You can think of `src/app.ts` as the layer that translates HTTP activity into logs.

It does not choose the global logging policy.
It does not implement file rotation.

Instead, it decides:

- what request data should be logged
- when a request should be logged
- what severity a request should get
- how uncaught Express errors should be recorded
