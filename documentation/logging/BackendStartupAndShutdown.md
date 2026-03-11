# Understanding `src/index.ts`

This document explains what `src/index.ts` is doing in the backend application.
It is the main entry point of the server, which means this file is responsible for
starting the app, configuring logging, creating the database connection pool,
starting the HTTP server, and handling shutdown or unexpected runtime failures.

The goal of this walkthrough is not just to say "what each line says", but to
explain why the code is written in this order and what role each part plays in
the lifecycle of the application.

## High-Level Purpose

At a high level, this file answers five questions:

1. Where does application startup begin?
2. How is logging configured before anything important happens?
3. How do we connect the server to the database?
4. How do we start accepting HTTP requests?
5. How do we shut everything down safely if the process is terminated or crashes?

That is why this file is small but important. It does not contain business logic,
but it controls the application lifecycle.

## Section 1: File Header Comment

```ts
/**
 * Service entry point.
 *
 * Starts the HTTP server and wires graceful shutdown to release
 * database resources cleanly.
 */
```

This block is a documentation comment.

- `Service entry point.` means this is the first backend file that runs when the
  app starts.
- `Starts the HTTP server` tells us this file is responsible for making Express
  listen on a port.
- `wires graceful shutdown` means this file also handles cleanup when the app is
  stopping.
- `release database resources cleanly` refers to closing the Postgres connection
  pool instead of letting the process die abruptly.

Why this matters:
If someone wants to understand how the server boots up, this is the first file
they should read.

## Section 2: Imports

```ts
import { createApp } from "./app";
import { config } from "./config";
import { createPool } from "./db/pool";
import { configureLogger, getLogger, toErrorMeta } from "./logging/logger";
```

These imports pull in the building blocks needed for startup.

### `createApp`

```ts
import { createApp } from "./app";
```

This imports the function that creates the Express application instance.

What it gives us:

- route registration
- middleware registration
- error handling
- static file serving

In other words, `createApp` builds the web application object, but it does not
start the server listening by itself.

### `config`

```ts
import { config } from "./config";
```

This imports the validated runtime configuration.

What it contains:

- environment name
- server port
- database settings
- logging settings

Why this matters:
Instead of reading `process.env` everywhere, the application validates env
variables once and then uses a clean, typed config object.

### `createPool`

```ts
import { createPool } from "./db/pool";
```

This imports the helper that creates the PostgreSQL connection pool.

Why a pool is used:

- opening a fresh database connection per request is expensive
- a pool reuses connections
- it gives the app a shared database access layer

### `configureLogger`, `getLogger`, `toErrorMeta`

```ts
import { configureLogger, getLogger, toErrorMeta } from "./logging/logger";
```

These are the logging tools used in this file.

- `configureLogger(...)`
  initializes the logger system with environment-specific settings.
- `getLogger("index")`
  creates a logger labeled with the module name `"index"`.
- `toErrorMeta(error)`
  converts an `Error` object into structured metadata such as error name,
  message, and stack trace.

Why this matters:
This file is not just starting the app. It is making sure that startup,
shutdown, and crash events are visible in logs.

## Section 3: Configure Logging First

```ts
configureLogger({
  environment: config.environment,
  level: config.logging.level,
  consoleLevel: config.logging.consoleLevel,
  logDir: config.logging.logDir,
  fileName: config.logging.fileName,
  maxBytes: config.logging.maxBytes,
  maxFiles: config.logging.maxFiles,
  enableFileLogging: config.logging.enableFileLogging,
});
```

This is one of the most important parts of the file.

The logger is configured immediately at startup, before the pool is created and
before the server starts listening.

That ordering is intentional.

Why configure logging this early:

- if database setup fails, we want that failure logged
- if the app crashes during startup, we want that failure logged
- if the server starts successfully, we want that startup event logged too

### What each field means

#### `environment: config.environment`

This tells the logger whether it is running in:

- `development`
- `test`
- `production`

This affects default behavior.

Example:

- development can be noisy and verbose
- production should be more selective

#### `level: config.logging.level`

This is the main logging threshold.

Meaning:

- `debug` logs everything
- `info` logs informational events and above
- `warn` logs warnings and errors
- `error` logs only errors

This controls what messages are accepted at all.

#### `consoleLevel: config.logging.consoleLevel`

This controls what gets printed to the terminal.

Why separate it from `level`:
You may want to write more logs to file than you print to the console.

Example:

- file logs might keep `info`
- console might show only `warn` and `error`

That keeps production terminals cleaner while preserving detailed logs on disk.

#### `logDir: config.logging.logDir`

This is the directory where log files are written.

In this project, the default is `logs/`.

#### `fileName: config.logging.fileName`

This is the current active log filename.

In this project, the default is `app.log`.

#### `maxBytes: config.logging.maxBytes`

This is the maximum size of a log file before rotation happens.

In this project, it is set to `5 MB`.

#### `maxFiles: config.logging.maxFiles`

This is the number of rotated backup files to keep.

In this project:

- `app.log` is the current live file
- `app.log.1` is the newest rotated backup
- `app.log.2` is older
- `app.log.3` is the oldest kept backup

#### `enableFileLogging: config.logging.enableFileLogging`

This decides whether logs are written to files at all.

Why it exists:
During tests, we usually do not want log files constantly being created in the
repository.

## Section 4: Create a Module Logger and Log Startup

```ts
const logger = getLogger("index");
logger.info("Application startup", {
  environment: config.environment,
  port: config.port,
  log_dir: config.logging.logDir,
  log_file: config.logging.fileName,
});
```

### `const logger = getLogger("index");`

This creates a logger instance for this file.

The string `"index"` becomes the module name in log lines.

Example log line:

```text
2026-03-10T03:12:45.123Z | INFO | index | Application startup {"environment":"development","port":3000,"log_dir":"logs","log_file":"app.log"}
```

Why use a module name:

- it tells you where a log came from
- it makes debugging faster
- it separates startup logs from route logs or service logs

### `logger.info("Application startup", ...)`

This writes a startup log entry.

Why log startup:

- confirms the app began booting
- captures important boot configuration
- helps prove which environment and port were used

### The metadata object

```ts
{
  environment: config.environment,
  port: config.port,
  log_dir: config.logging.logDir,
  log_file: config.logging.fileName,
}
```

This object is structured metadata.

Why structured metadata is useful:

- machines can parse it
- humans can read it
- it avoids packing everything into a single long string

Instead of logging:

```ts
"Application startup on port 3000 in development using logs/app.log";
```

we log:

```ts
"Application startup", { environment: "...", port: ..., ... }
```

That is better for diagnostics.

## Section 5: Create Shared Infrastructure

```ts
const pool = createPool();
const app = createApp(pool);
```

These two lines build the main backend dependencies.

### `const pool = createPool();`

This creates the shared PostgreSQL connection pool.

Why it happens before the app is used:

- routes and services need database access
- the app should use one shared pool, not create a new pool per request

What this means operationally:
Every request that needs the database can borrow a connection from this pool.

### `const app = createApp(pool);`

This creates the Express app and injects the pool into it.

Why pass the pool in:

- it makes dependencies explicit
- it improves testability
- it avoids hidden global state

This is a dependency injection style.

Instead of the routes creating database connections by themselves, they receive
the already-created pool from startup code.

## Section 6: Start the HTTP Server

```ts
const server = app.listen(config.port, () => {
  logger.info("HTTP server listening", { port: config.port });
});
```

This is the moment the application begins accepting incoming network requests.

### `app.listen(config.port, ...)`

This tells Express:
"Bind to this port and start listening for HTTP traffic."

If `config.port` is `3000`, then the app becomes reachable at something like:

```text
http://localhost:3000
```

### Why the return value is stored

```ts
const server = ...
```

The `server` object is saved because it is needed later for shutdown.

Without this object:

- you can start the server
- but you cannot properly tell it to stop accepting new requests

### Why the callback logs startup completion

```ts
() => {
  logger.info("HTTP server listening", { port: config.port });
};
```

This callback only runs after the server successfully starts listening.

That means this log is stronger than the earlier startup log.

Difference:

- `Application startup` means the boot sequence started
- `HTTP server listening` means boot completed successfully

That distinction is useful when diagnosing startup failures.

## Section 7: The `shutdown` Function

```ts
async function shutdown(signal: string): Promise<void> {
  logger.info("Received shutdown signal", { signal });

  // Stop accepting new connections.
  server.close(async () => {
    // Close the database pool to release TCP connections.
    try {
      await pool.end();
      logger.info("Shutdown complete", { signal });
      process.exit(0);
    } catch (error) {
      logger.error("Failed to close database pool during shutdown", {
        signal,
        ...toErrorMeta(error),
      });
      process.exit(1);
    }
  });
}
```

This function handles graceful shutdown.

Graceful shutdown means:

- stop taking new requests
- clean up resources
- exit intentionally

instead of:

- abruptly killing the process
- leaving connections hanging
- losing visibility into shutdown behavior

### `async function shutdown(signal: string): Promise<void>`

This defines a reusable shutdown routine.

Why it accepts `signal: string`:
The app wants to know what caused the shutdown.

Examples:

- `SIGINT` often comes from pressing `Ctrl + C`
- `SIGTERM` often comes from a deployment platform or container orchestrator

### `logger.info("Received shutdown signal", { signal });`

This logs the fact that shutdown has started.

Why this is useful:

- proves the process received the signal
- distinguishes shutdown from crashes
- helps when investigating deployments or restarts

### `server.close(...)`

This is critical.

It tells the HTTP server:

- stop accepting new incoming connections
- finish handling requests already in progress

Why this matters:
If you just call `process.exit()` immediately, active requests could be cut off.

### `await pool.end();`

This closes the Postgres pool.

What it means:

- database clients are cleaned up
- TCP connections are closed
- the process avoids leaking open DB resources

Why this matters:
Leaving the pool open can prevent clean termination or leave connections open on
the database side.

### `logger.info("Shutdown complete", { signal });`

This confirms successful shutdown.

This is the "happy path" end-of-life log.

### `process.exit(0);`

Exit code `0` means success.

That tells the operating system:

- shutdown completed normally
- this was not considered a fatal failure

### The `catch (error)` block

```ts
catch (error) {
  logger.error("Failed to close database pool during shutdown", {
    signal,
    ...toErrorMeta(error),
  });
  process.exit(1);
}
```

If cleanup fails, the app logs it as an error.

Why `toErrorMeta(error)` is used:
It converts the thrown error into structured fields like:

- error name
- error message
- stack trace

Why `process.exit(1)` is used:
Exit code `1` tells the operating system that shutdown did not complete cleanly.

## Section 8: Handle OS Termination Signals

```ts
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

These lines register signal handlers on the Node.js process.

### `SIGINT`

```ts
process.on("SIGINT", () => void shutdown("SIGINT"));
```

This usually happens when a developer presses `Ctrl + C` in the terminal.

Instead of killing the app immediately, the code routes that event through the
graceful shutdown function.

### `SIGTERM`

```ts
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

This signal is commonly used by:

- hosting platforms
- Docker
- orchestration systems
- deployment tools

Again, the code routes the event through graceful shutdown instead of abruptly
stopping.

### Why `() => void shutdown(...)` is used

`shutdown(...)` returns a promise because it is `async`.

The `void` tells TypeScript and readers:

- we intentionally trigger the async function
- we are not awaiting it in this event callback

It is a small clarity signal.

## Section 9: Handle Last-Resort Failures

```ts
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", toErrorMeta(error));
});
```

An `uncaughtException` means some synchronous error escaped all normal error
handling and reached the process level.

Why log this:

- it is a serious failure
- it often explains why the process became unstable
- the stack trace is usually essential

Now the second one:

```ts
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? toErrorMeta(reason) : String(reason),
  });
});
```

An `unhandledRejection` means a promise failed and nobody handled the rejection.

Why this matters in Node.js:
Many backend operations are async:

- database calls
- HTTP calls
- file operations
- service logic

If a promise rejection is ignored, the process can become unpredictable.

### Why the code checks `reason instanceof Error`

Not every rejected promise throws an actual `Error` object.

Some bad code rejects with:

- strings
- plain objects
- numbers

So this line handles both cases:

```ts
reason instanceof Error ? toErrorMeta(reason) : String(reason);
```

Meaning:

- if it is a real `Error`, preserve structured error details
- otherwise, convert it to a readable string

## Execution Order: What Happens When the App Starts

When Node runs this file, the order is:

1. Imports are resolved.
2. `configureLogger(...)` runs.
3. A module logger is created with `getLogger("index")`.
4. `"Application startup"` is logged.
5. The database pool is created.
6. The Express app is created with that pool.
7. The HTTP server starts listening on the configured port.
8. `"HTTP server listening"` is logged.
9. Signal handlers and process-level failure handlers remain registered while
   the process is alive.

This order is deliberate.

If logging were configured later, startup failures earlier in the sequence could
be missed.

## Execution Order: What Happens During Shutdown

If the app receives `SIGINT` or `SIGTERM`:

1. `shutdown(signal)` runs.
2. The signal is logged.
3. `server.close(...)` stops new incoming requests.
4. `pool.end()` closes database resources.
5. If successful, `"Shutdown complete"` is logged and the process exits with `0`.
6. If cleanup fails, the error is logged and the process exits with `1`.

This is what makes the shutdown graceful rather than abrupt.

## Why `src/index.ts` Matters for Logging

This file is the correct place to configure logging because it sits at the top
of the backend lifecycle.

That gives it control over:

- startup logs
- server-ready logs
- shutdown logs
- process-level crash logs

If logging were configured deep inside a route or service instead, those earlier
lifecycle events could be invisible.

# Logging

- Logging is configured once at startup in [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts).
- Log entries include ISO timestamp, level, module name, message, and JSON metadata when present.
- File logs rotate automatically at `5 MB`, which means the active `app.log` file is renamed and replaced once it grows past that size.
- Rotation prevents a single log file from growing forever and consuming unnecessary disk space over time.
- The rotated files are kept as `app.log.1`, `app.log.2`, and `app.log.3`, with `app.log.1` being the most recent previous file.
- When a new rotation happens, older backups shift forward and anything older than `app.log.3` is discarded.
- In practice, this setup keeps `1` live log file plus `3` backup files, for roughly `20 MB` of retained log history at most.
- Development defaults to verbose console and file logging.
- Production defaults to `INFO`+ in the file and `WARNING`+ in the console.
- Test runs disable file logging to avoid polluting the repo workspace.

### Signal Handler Note

In the backend entrypoint, the shutdown listeners use:

```ts
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

What this means:

- `process.on(...)` registers the listener once during startup.
- Later, if the running process receives `SIGINT` or `SIGTERM`, Node invokes that listener.
- The listener then starts `shutdown(...)`.
- `shutdown(...)` is `async`, so it returns a promise.
- The `void` does not make `process.on(...)` async and does not change how signals are handled.
- The `void` only makes it explicit that the returned promise is intentionally ignored.
- `process.on(...)` does not use the listener's return value anyway, so this is mainly about code clarity and avoiding floating-promise warnings in some lint setups.
- Saying "we are not awaiting it in this event callback" means the callback itself does not do `await shutdown(...)`.
- Separately, `process.on(...)` does not await the listener's return value either, even if the listener is `async`.

## Final Mental Model

You can think of `src/index.ts` as the backend conductor.

It does not perform reporting queries.
It does not process manufacturing logs.
It does not define routes.

Instead, it coordinates the system:

- initialize shared infrastructure
- start the application
- announce important lifecycle events through logging
- clean up resources when the app ends

That is why this file is short, but foundational.
