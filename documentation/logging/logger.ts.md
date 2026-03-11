# Understanding `src/logging/logger.ts`

This document explains what [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts) is doing and why it is structured this way.

If [documentation/logging/BackendStartupAndShutdown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/BackendStartupAndShutdown.md) explains where logging is initialized, this document explains how the logger itself actually works.

This file is the core logging engine for the backend. It is responsible for:

- defining logging-related types
- deciding whether a log message should be emitted
- formatting log lines
- writing logs to the console
- writing logs to a file
- rotating log files when they get too large
- keeping a single active logger manager for the whole process
- normalizing metadata so logs stay readable and structured

## High-Level Purpose

This file answers the following questions:

1. What is a logger in this project?
2. How do we configure it?
3. How do log levels work?
4. When do logs go to the console?
5. When do logs go to files?
6. How does file rotation work?
7. How do we make all modules share one active logger manager?
8. How do we keep metadata safe and readable?

This file does not know anything about reports, jobs, routes, or the database schema.
It is intentionally generic. Its only concern is logging behavior.

## Section 1: Imports

```ts
import fs from "fs";
import path from "path";
```

These are Node.js built-in modules.

- `fs` is used for file system operations
- `path` is used to safely build file paths

Why they are needed:

- the logger writes log files
- the logger checks file sizes
- the logger creates directories
- the logger renames and deletes rotated log files

This logger is intentionally implemented without an external logging library, so
these low-level filesystem operations are handled directly here.

## Section 2: Exported Types

```ts
export type EnvironmentName = "development" | "test" | "production";
export type LogLevelName = "debug" | "info" | "warn" | "error" | "silent";
export type LogMeta = Record<string, unknown>;
```

These types define the basic language of the logging system.

### `EnvironmentName`

This restricts the environment to one of:

- `development`
- `test`
- `production`

Why this is useful:

- prevents arbitrary string values
- makes default behavior easier to control
- improves TypeScript safety

### `LogLevelName`

This defines the valid log levels.

Each level represents severity:

- `debug` for detailed development information
- `info` for normal system events
- `warn` for unusual but non-fatal situations
- `error` for failures
- `silent` for suppressing all logs

`silent` is a special case. It is not a traditional logging severity. It acts as
"log nothing."

### `LogMeta`

```ts
export type LogMeta = Record<string, unknown>;
```

This means log metadata is expected to be an object with string keys.

Example:

```ts
{
  port: 3000,
  environment: "production"
}
```

Why metadata matters:

- it makes logs structured
- it avoids stuffing everything into one giant string
- it is easier to search and parse later

## Section 3: Exported Interfaces

```ts
export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}
```

This is the public shape of a logger instance.

It tells the rest of the codebase:
"If you ask for a logger, these are the methods you can call."

Why this matters:

- route files can call `logger.info(...)`
- service files can call `logger.warn(...)`
- error handlers can call `logger.error(...)`

without needing to know how the logger works internally.

Now the config interface:

```ts
export interface LoggerConfig {
  environment: EnvironmentName;
  level: LogLevelName;
  consoleLevel: LogLevelName;
  logDir: string;
  fileName: string;
  maxBytes: number;
  maxFiles: number;
  enableFileLogging: boolean;
}
```

This defines everything needed to initialize the logging system.

Each field has a specific purpose:

- `environment`
  controls environment-specific defaults
- `level`
  is the main threshold for whether a message is accepted
- `consoleLevel`
  controls what is printed to the terminal
- `logDir`
  is the folder where logs are stored
- `fileName`
  is the current active log filename
- `maxBytes`
  is the rotation threshold
- `maxFiles`
  is the number of rotated backups to keep
- `enableFileLogging`
  turns file logging on or off

### Important clarification: `LoggerConfig` is a type, not the runtime config itself

`LoggerConfig` does not create values by itself.

It only describes the shape of a valid logger configuration object.

That means this:

```ts
export interface LoggerConfig {
  environment: EnvironmentName;
  level: LogLevelName;
  consoleLevel: LogLevelName;
  logDir: string;
  fileName: string;
  maxBytes: number;
  maxFiles: number;
  enableFileLogging: boolean;
}
```

is TypeScript saying:

"Any real config object given to the logger must have these fields."

The actual runtime values come from outside this file:

1. environment variables are read in [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
2. that file builds `config.logging`
3. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) passes those values into `configureLogger(...)`
4. `configureLogger(...)` creates `new LoggerManager(config)`
5. the `LoggerManager` constructor stores that object as `this.config`

So yes, `LoggerManager` works with outside-provided configuration objects.

There is no separate "logger server."

The injection is just normal code flow:

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

and then:

```ts
activeManager = new LoggerManager(config);
```

That is how the manager gets its own `level`, `consoleLevel`, and file settings.

## Section 4: Level Mapping

```ts
const LEVELS: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Number.POSITIVE_INFINITY,
};
```

This object converts human-readable log levels into numeric priorities.

More specifically, `LEVELS` is a normal JavaScript object, and TypeScript is
enforcing its shape.

This type:

```ts
Record<LogLevelName, number>
```

means:

- the keys of the object must be every valid `LogLevelName`
- the value for each key must be a number

Since:

```ts
type LogLevelName = "debug" | "info" | "warn" | "error" | "silent";
```

then:

```ts
Record<LogLevelName, number>
```

is essentially the same idea as:

```ts
{
  debug: number;
  info: number;
  warn: number;
  error: number;
  silent: number;
}
```

So at runtime, `LEVELS` is just a plain object.

At compile time, TypeScript checks that:

- no required log-level key is missing
- no value has the wrong type

That is why this object can safely be used later like:

```ts
LEVELS["debug"]   // 10
LEVELS["info"]    // 20
LEVELS["warn"]    // 30
LEVELS["error"]   // 40
```

Why use numbers:

- comparing numbers is easier than comparing strings
- it makes threshold checks simple

For example:

- `debug` is `10`
- `info` is `20`
- `warn` is `30`
- `error` is `40`

So if the configured level is `info`, then:

- `debug` is below the threshold and gets dropped
- `info`, `warn`, and `error` are allowed through

### Why `silent` is `Number.POSITIVE_INFINITY`

This is clever and intentional.

If the configured level is `silent`, then every real log level is less than
infinity, so every message fails the threshold test and gets dropped.

This is how the logger implements "log nothing" without adding special-case logic
all over the file.

## Section 5: `LoggerManager`

```ts
class LoggerManager {
  private readonly filePath: string;
  private directoryReady = false;
```

This class is the real runtime engine of the logger.

Why there is a class:

- it keeps the logger configuration in one place
- it manages the file path
- it handles file output and rotation
- it avoids scattering state across multiple helper functions

### `private readonly filePath: string;`

This stores the full path to the active log file.

Example:

```text
/project/logs/app.log
```

### `private directoryReady = false;`

This is a small optimization flag.

Why it exists:

- the logger may be called many times
- we do not want to run `mkdirSync(...)` every single time

So once the log directory has been created or confirmed, this flag is set to
`true` and the logger skips the directory creation check on future writes.

## Section 6: Constructor

```ts
constructor(private readonly config: LoggerConfig) {
  this.filePath = path.join(config.logDir, config.fileName);
}
```

The constructor stores the logging configuration and derives the final file path.

### `private readonly config: LoggerConfig`

This means the manager keeps the config object internally and does not expose it
for outside mutation.

This is where `this.config.level` comes from later in the `write(...)` method.

So when you see:

```ts
this.config.level
```

that means:

- "the configured minimum severity threshold stored inside this manager instance"

That value was supplied from startup configuration, not invented inside `LoggerManager`.

### `this.filePath = path.join(config.logDir, config.fileName);`

This combines the directory and filename safely.

Example:

- `logDir = "logs"`
- `fileName = "app.log"`
- result becomes `logs/app.log`

Using `path.join(...)` is safer than manual string concatenation because it
handles path separators correctly.

## Section 7: The `write(...)` Method

```ts
write(
  level: LogLevelName,
  moduleName: string,
  message: string,
  meta?: LogMeta,
): void {
  if (LEVELS[level] < LEVELS[this.config.level]) {
    return;
  }

  const entry = formatEntry(level, moduleName, message, meta);

  if (LEVELS[level] >= LEVELS[this.config.consoleLevel]) {
    writeToConsole(level, entry);
  }

  if (this.config.enableFileLogging) {
    this.writeToFile(entry);
  }
}
```

This is the central method of the entire logger.

Every actual log call eventually funnels through here.

Example:

- `logger.info("Application startup", ...)`
- `logger.warn("Large result set", ...)`
- `logger.error("Database failed", ...)`

all end up calling `LoggerManager.write(...)`.

### Step 1: Threshold check

```ts
if (LEVELS[level] < LEVELS[this.config.level]) {
  return;
}
```

This asks:
"Is this message below the configured minimum level?"

If yes, the method returns immediately and nothing is logged.

Example:

- configured level = `info`
- message level = `debug`
- `10 < 20`
- message is dropped

Another example:

- configured level = `info`
- message level = `error`
- `40 < 20`
- this is `false`
- so the method does not return early
- the message is allowed through

### What is actually being compared here

There are two different `level` values involved:

- `level`
  the severity of the current log call, such as `"debug"` or `"error"`
- `this.config.level`
  the minimum configured threshold for the logger manager

So if the app does:

```ts
logger.debug("something")
```

then inside `write(...)`:

- `level` is `"debug"`

If the logger configuration says:

```ts
this.config.level === "info"
```

then the check becomes:

```ts
LEVELS["debug"] < LEVELS["info"]
```

which means:

```ts
10 < 20
```

So the logger drops the message.

If the app does:

```ts
logger.error("something failed")
```

then the check becomes:

```ts
LEVELS["error"] < LEVELS["info"]
```

which means:

```ts
40 < 20
```

That is false, so the logger keeps the message.

### Why this comparison exists at all

The purpose is to filter noise.

Not every log message is equally important.

If the logger printed everything in every environment, logs would quickly become
too noisy, too large, and too hard to read.

The configured threshold says:

"Only keep messages that are at least this important."

So if the threshold is `info`:

- `debug` is too low and gets filtered out
- `info` is allowed
- `warn` is allowed
- `error` is allowed

This is why the numbers are ordered upward:

- `debug = 10`
- `info = 20`
- `warn = 30`
- `error = 40`

Higher number means more severe.

So the rule is:

- if the message severity is below the threshold, drop it
- otherwise, keep it

That helps:

- reduce low-value noise
- keep production logs readable
- avoid filling log files with development-only detail
- still allow very verbose output in development when wanted

This is the first gate.

### Step 2: Format the log line

```ts
const entry = formatEntry(level, moduleName, message, meta);
```

At this point the message has been accepted, so the logger builds the final log string.

Example output:

```text
2026-03-10T03:12:45.123Z | INFO | index | Application startup {"port":3000}
```

### Step 3: Decide whether to print to console

```ts
if (LEVELS[level] >= LEVELS[this.config.consoleLevel]) {
  writeToConsole(level, entry);
}
```

This is a second threshold, specifically for terminal output.

Important distinction:

- `level` is the overall threshold for whether the logger accepts the event
- `consoleLevel` is only about whether it appears in the console

So a log may:

- be accepted overall
- be written to file
- but still not be shown in the terminal

That is useful in production.

Example:

- overall level = `info`
- console level = `warn`

Then:

- `info` logs go to file
- `warn` and `error` go to both file and console

### Step 4: Decide whether to write to file

```ts
if (this.config.enableFileLogging) {
  this.writeToFile(entry);
}
```

If file logging is enabled, the entry is written to the log file.

Why make this configurable:

- tests usually do not need log files
- sometimes local runs may want console-only behavior

## Section 8: Writing to File

```ts
private writeToFile(entry: string): void {
  this.ensureDirectory();

  const line = `${entry}\n`;
  const nextSize = Buffer.byteLength(line, "utf8");
  const currentSize = fs.existsSync(this.filePath)
    ? fs.statSync(this.filePath).size
    : 0;

  if (currentSize + nextSize > this.config.maxBytes) {
    this.rotateFiles();
  }

  fs.appendFileSync(this.filePath, line, "utf8");
}
```

This method handles actual file persistence.

### `this.ensureDirectory();`

Before writing, the logger makes sure the log directory exists.

Without this, the first file write could fail if `logs/` is missing.

### `const line = `${entry}\n`;`

The logger adds a newline so each log entry appears on its own line.

Without the newline, logs would all be appended into one unreadable line.

### `const nextSize = Buffer.byteLength(line, "utf8");`

This calculates how many bytes the new line will consume.

Why bytes, not characters:

- files are measured in bytes
- UTF-8 characters can vary in size

So byte length is the correct metric for rotation.

### Current file size check

```ts
const currentSize = fs.existsSync(this.filePath)
  ? fs.statSync(this.filePath).size
  : 0;
```

This asks:

- if the file already exists, how large is it?
- if it does not exist, treat it as size `0`

### Rotation threshold check

```ts
if (currentSize + nextSize > this.config.maxBytes) {
  this.rotateFiles();
}
```

This means:
"If appending the new entry would push the file over the maximum size, rotate first."

This is why people say "rotate at 5 MB."

It does not mean the file is constantly split.
It means:

- keep appending normally
- once the next write would exceed the cap
- archive the current file
- start a fresh one

### `fs.appendFileSync(...)`

The final line appends the formatted log entry to the file.

This implementation uses synchronous file I/O.

Why that is acceptable here:

- the logger is simple
- log writes are short
- the project is not trying to optimize for ultra-high-throughput logging

The main advantage is predictable, straightforward behavior.

## Section 9: Ensuring the Directory Exists

```ts
private ensureDirectory(): void {
  if (this.directoryReady) {
    return;
  }

  fs.mkdirSync(this.config.logDir, { recursive: true });
  this.directoryReady = true;
}
```

This method makes sure the log directory exists before file writes happen.

### The fast path

```ts
if (this.directoryReady) {
  return;
}
```

If the logger already knows the directory exists, it exits immediately.

This avoids unnecessary repeated work.

### `fs.mkdirSync(this.config.logDir, { recursive: true });`

This creates the directory if needed.

Why `recursive: true` matters:

- it avoids failure if parent directories also need to be created
- it is safe even if the directory already exists

### `this.directoryReady = true;`

Once the directory check passes, the manager remembers that state.

## Section 10: Log Rotation

```ts
private rotateFiles(): void {
  const oldestFile = `${this.filePath}.${this.config.maxFiles}`;
  if (fs.existsSync(oldestFile)) {
    fs.unlinkSync(oldestFile);
  }

  for (let index = this.config.maxFiles - 1; index >= 1; index -= 1) {
    const source = `${this.filePath}.${index}`;
    const destination = `${this.filePath}.${index + 1}`;

    if (fs.existsSync(source)) {
      fs.renameSync(source, destination);
    }
  }

  if (fs.existsSync(this.filePath)) {
    fs.renameSync(this.filePath, `${this.filePath}.1`);
  }
}
```

This is the file rotation algorithm.

It is small, but it is one of the most important pieces of the logger.

### Step 1: Remove the oldest kept file

```ts
const oldestFile = `${this.filePath}.${this.config.maxFiles}`;
if (fs.existsSync(oldestFile)) {
  fs.unlinkSync(oldestFile);
}
```

If the maximum backup count is `3`, then the oldest file is:

```text
app.log.3
```

If it exists, it is deleted first to make room for the shift.

Why this must happen first:

Because later renames would otherwise collide.

### Step 2: Shift existing backups upward

```ts
for (let index = this.config.maxFiles - 1; index >= 1; index -= 1) {
  const source = `${this.filePath}.${index}`;
  const destination = `${this.filePath}.${index + 1}`;

  if (fs.existsSync(source)) {
    fs.renameSync(source, destination);
  }
}
```

This loop runs backward on purpose.

Why backward matters:

If we moved forward instead:

- `app.log.1` to `app.log.2`
- then `app.log.2` to `app.log.3`

we could overwrite files before moving them.

By moving backward:

- `app.log.2` becomes `app.log.3`
- then `app.log.1` becomes `app.log.2`

we avoid clobbering data.

### Step 3: Move the active file into backup slot `.1`

```ts
if (fs.existsSync(this.filePath)) {
  fs.renameSync(this.filePath, `${this.filePath}.1`);
}
```

At this point:

- the backup slots are ready
- so the current live `app.log` is renamed to `app.log.1`

Then the next file write creates a fresh new `app.log`.

### Concrete example

Before rotation:

```text
app.log
app.log.1
app.log.2
app.log.3
```

After rotation:

- old `app.log.3` is deleted
- old `app.log.2` becomes `app.log.3`
- old `app.log.1` becomes `app.log.2`
- old `app.log` becomes `app.log.1`
- a new empty `app.log` will be created on the next append

This is how the logger keeps bounded history instead of infinite growth.

## Section 11: Active Manager Singleton

```ts
let activeManager: LoggerManager | null = null;
```

This stores the one active logger manager for the process.

Why this exists:

- logging should use one consistent config
- all modules should write through the same manager
- rotation and file settings should be centralized

This is a singleton-like pattern.

It is not a formal singleton class, but it behaves like a single shared runtime instance.

## Section 12: `configureLogger(...)`

```ts
export function configureLogger(config: LoggerConfig): void {
  activeManager = new LoggerManager(config);
}
```

This sets the active logger manager.

Why it is called from `src/index.ts`:

- startup is the right place to configure shared infrastructure
- the app should decide its environment-specific config once

After this function runs, all `getLogger(...)` calls use this configured manager.

## Section 13: `getLogger(...)`

```ts
export function getLogger(moduleName: string): Logger {
  return {
    debug: (message, meta) =>
      getManager().write("debug", moduleName, message, meta),
    info: (message, meta) =>
      getManager().write("info", moduleName, message, meta),
    warn: (message, meta) =>
      getManager().write("warn", moduleName, message, meta),
    error: (message, meta) =>
      getManager().write("error", moduleName, message, meta),
  };
}
```

This returns a lightweight logger object for a specific module.

Example:

```ts
const logger = getLogger("service.report");
logger.info("Running weekly summary query");
```

This means:

- the caller does not need direct access to `LoggerManager`
- the caller just gets four methods
- the module name is baked into those methods

### Why `getManager()` is called inside each method

This is subtle and important.

Notice this pattern:

```ts
() => getManager().write(...)
```

instead of:

```ts
const manager = getManager();
return {
  info: (...) => manager.write(...)
}
```

Why this matters:

The current implementation resolves the manager at call time, not logger-creation time.

That means if the app later calls `configureLogger(...)`, existing logger objects still use the current active manager.

This avoids stale configuration being captured too early.

That is an important design detail.

## Section 14: `resetLoggerForTests(...)`

```ts
export function resetLoggerForTests(): void {
  activeManager = null;
}
```

This resets the global manager state.

Why tests need this:

- tests should not leak logger state across runs
- one test may configure logging differently than another

By clearing `activeManager`, the next test starts fresh.

### What "leak logger state across runs" means

The key issue is that this variable is shared global state:

```ts
let activeManager: LoggerManager | null = null;
```

That means once one test creates or configures a manager, a later test can still
see and reuse that same manager unless it is explicitly reset.

### Concrete example

Suppose Test 1 does this:

```ts
configureLogger({
  environment: "development",
  level: "debug",
  consoleLevel: "silent",
  logDir: "/tmp/test-a",
  fileName: "app.log",
  maxBytes: 100,
  maxFiles: 3,
  enableFileLogging: true,
});
```

Now `activeManager` points to a logger configured to:

- write into `/tmp/test-a`
- use `debug` as the minimum level
- keep file logging enabled

If Test 2 runs afterward and does not reset the logger, then this code:

```ts
const logger = getLogger("test");
logger.info("hello");
```

may still use the manager created by Test 1.

That means Test 2 could accidentally inherit:

- the previous test's log directory
- the previous test's log levels
- the previous test's file settings

So Test 2 would not really be starting from a clean state.

That is what "state leaking across runs" means here.

`resetLoggerForTests()` prevents that by clearing `activeManager`, so the next
test either:

- configures a fresh logger explicitly, or
- gets a fresh default manager through `getManager()`

## Section 15: `toErrorMeta(...)`

```ts
export function toErrorMeta(error: unknown): LogMeta {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
    };
  }

  return {
    error_message: String(error),
  };
}
```

This converts unknown thrown values into safe structured log metadata.

Why this is needed:

In JavaScript and TypeScript, not everything thrown is actually an `Error`.

Bad code can do things like:

```ts
throw "something bad happened";
throw 123;
throw { problem: true };
```

So the logger cannot assume it always receives a real `Error`.

### If the value is an `Error`

It extracts:

- `error_name`
- `error_message`
- `error_stack`

This gives logs much better debugging value.

### If it is not an `Error`

It falls back to:

```ts
{ error_message: String(error) }
```

This ensures logging still succeeds.

### Concrete examples

If a real `Error` is passed in:

```ts
const error = new Error("Database connection failed");
const meta = toErrorMeta(error);
```

then `meta` looks like:

```ts
{
  error_name: "Error",
  error_message: "Database connection failed",
  error_stack: "Error: Database connection failed\n    at ..."
}
```

This is useful because the logger captures:

- the error type
- the readable message
- the stack trace showing where the failure happened

Example in a log call:

```ts
try {
  await pool.query("SELECT * FROM missing_table");
} catch (error) {
  logger.error("Weekly summary query failed", toErrorMeta(error));
}
```

That could produce a log line like:

```text
2026-03-10T03:12:45.123Z | ERROR | service.report | Weekly summary query failed {"error_name":"Error","error_message":"relation \"missing_table\" does not exist","error_stack":"Error: relation \"missing_table\" does not exist ..."}
```

Now compare that to non-`Error` thrown values.

If code does this:

```ts
throw "something bad happened";
```

then:

```ts
toErrorMeta("something bad happened")
```

becomes:

```ts
{
  error_message: "something bad happened"
}
```

If code does this:

```ts
throw 123;
```

then:

```ts
{
  error_message: "123"
}
```

If code does this:

```ts
throw { problem: true };
```

then:

```ts
{
  error_message: "[object Object]"
}
```

That last result is not especially rich, but it is still safe and loggable.

So the practical purpose of `toErrorMeta(...)` is:

- if the thrown value is a real `Error`, preserve detailed debugging information
- if it is not a real `Error`, still convert it into something the logger can safely write

## Section 16: Default Configuration

```ts
function createDefaultConfig(): LoggerConfig {
  const environment = inferEnvironment();

  return {
    environment,
    level: defaultLogLevel(environment),
    consoleLevel: defaultConsoleLevel(environment),
    logDir: path.join(process.cwd(), "logs"),
    fileName: "app.log",
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 3,
    enableFileLogging: environment !== "test",
  };
}
```

This creates a fallback config if the logger is used before explicit configuration happens.

Why this exists:

- it makes the logger safer to use early
- it prevents crashes if a module asks for a logger before startup config runs

### Important defaults

- log directory is `logs/`
- filename is `app.log`
- rotation threshold is `5 MB`
- backup count is `3`
- file logging is off during tests

This fallback keeps the logger functional even before `configureLogger(...)` is called.

### What this means in practice

The normal app startup path is:

1. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) runs
2. it calls `configureLogger(...)`
3. that creates the real `LoggerManager` using the app's validated config

But if some code reaches for a logger before that happens:

```ts
const logger = getLogger("some.module");
```

the logger still does not fail.

Why it does not fail:

- `getLogger(...)` eventually depends on `getManager()`
- `getManager()` checks whether `activeManager` already exists
- if it does not, `getManager()` creates one using `createDefaultConfig()`

That means the logger has a fallback path.

So the important idea is not:

- "there is a permanent global config already sitting there"

The more precise idea is:

- there is fallback logic in `logger.ts`
- if no manager has been configured yet, the logger lazily creates a default one

This is what makes early logging safe.

The flow looks like this:

1. `activeManager` starts as `null`
2. some code calls `getLogger(...)`
3. later, a logger method like `logger.info(...)` calls `getManager()`
4. `getManager()` sees that there is no configured manager yet
5. it creates `new LoggerManager(createDefaultConfig())`
6. logging continues with sane fallback defaults

## Section 17: `getManager(...)`

```ts
function getManager(): LoggerManager {
  if (!activeManager) {
    activeManager = new LoggerManager(createDefaultConfig());
  }

  return activeManager;
}
```

This ensures there is always an active manager.

Behavior:

- if one already exists, return it
- if not, create one with default settings

This is lazy initialization.

Why it is useful:

- no need to eagerly create a manager at module load time
- no crash if logging is used before explicit setup

## Section 18: Environment Inference

```ts
function inferEnvironment(): EnvironmentName {
  const rawEnvironment =
    process.env.NODE_ENV ??
    (process.env.JEST_WORKER_ID ? "test" : "development");

  if (
    rawEnvironment === "development" ||
    rawEnvironment === "test" ||
    rawEnvironment === "production"
  ) {
    return rawEnvironment;
  }

  return "development";
}
```

This function decides the runtime environment when no validated config has already supplied it.

### First preference: `process.env.NODE_ENV`

If `NODE_ENV` exists, use it.

### Special test fallback

```ts
(process.env.JEST_WORKER_ID ? "test" : "development")
```

If `NODE_ENV` is missing but Jest is running, infer `test`.

Why that is smart:

- test runs should behave like tests
- they should not accidentally default to development behavior

### Final fallback

If the environment is unknown or invalid, default to `development`.

That is a safe default for local work.

## Section 19: Default Levels

```ts
function defaultLogLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "info";
  }

  if (environment === "test") {
    return "warn";
  }

  return "debug";
}
```

This controls the overall logging threshold by environment.

Meaning:

- production is quieter than development
- tests are quieter than development
- development is most verbose

Now the console version:

```ts
function defaultConsoleLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "warn";
  }

  if (environment === "test") {
    return "error";
  }

  return "debug";
}
```

This makes console output even stricter than file output in some environments.

Why:

- production terminals should not be spammed with normal info logs
- tests should stay quiet unless something is wrong

So by default:

- production files keep `info+`
- production console shows `warn+`

This is a practical design choice.

## Section 20: Formatting the Final Log Entry

```ts
function formatEntry(
  level: LogLevelName,
  moduleName: string,
  message: string,
  meta?: LogMeta,
): string {
  const timestamp = new Date().toISOString();
  const serializedMeta = serializeMeta(meta);

  return `${timestamp} | ${level.toUpperCase()} | ${moduleName} | ${message}${serializedMeta}`;
}
```

This function builds the final string that is written to the console or file.

The format is:

```text
timestamp | LEVEL | module | message {metadata}
```

### Why this format is useful

- timestamp tells you when
- level tells you severity
- module tells you where
- message tells you what happened
- metadata gives structured context

Example:

```text
2026-03-10T03:12:45.123Z | WARN | service.report | Weekly details query returned a large result set {"row_count":1200}
```

## Section 21: Serializing Metadata

```ts
function serializeMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(normalizeValue(meta))}`;
  } catch {
    return ' {"log_meta_error":"Failed to serialize metadata"}';
  }
}
```

This function converts the metadata object into a JSON string that can be appended to the log line.

### Empty metadata case

If metadata is missing or empty, it returns an empty string.

Why:

- logs should not end with useless `{}` all the time

### Normal case

```ts
JSON.stringify(normalizeValue(meta))
```

Before stringifying, the logger normalizes the values.

That is important because not everything in JavaScript serializes cleanly by default.

### Failure case

If serialization somehow fails, the logger still returns a valid fallback string:

```json
{"log_meta_error":"Failed to serialize metadata"}
```

This is an example of defensive logging design. Logging itself should not crash the app.

## Section 22: Normalizing Metadata Values

```ts
function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return toErrorMeta(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(value).flatMap(([key, entry]) => {
      if (entry === undefined || typeof entry === "function") {
        return [];
      }

      return [[key, normalizeValue(entry)]];
    });

    return Object.fromEntries(normalizedEntries);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}
```

This is one of the most defensive and important helpers in the file.

Its job is:
"Take arbitrary JavaScript values and turn them into something safe and JSON-friendly."

### Case 1: `Error`

If a metadata value is an `Error`, convert it into a structured error object via `toErrorMeta(...)`.

Why:

- raw `Error` objects do not stringify as usefully as you want
- the custom conversion preserves name, message, and stack

### Case 2: Arrays

If the value is an array, normalize every element recursively.

This means nested arrays containing errors, objects, or bigints are handled safely.

### Case 3: Plain objects

If the value is an object:

- iterate through its entries
- remove any values that are `undefined`
- remove any values that are functions
- recursively normalize everything else

Why omit `undefined` and functions:

- `undefined` is not useful in JSON logs
- functions are not meaningful log data

### Case 4: `bigint`

`JSON.stringify(...)` cannot serialize `bigint` values directly.

So the logger converts them to strings.

Without this, logging metadata containing a bigint would throw.

### Case 5: Primitive values

If the value is already something simple like:

- string
- number
- boolean
- null

it is returned as-is.

## Section 23: Writing to the Console

```ts
function writeToConsole(level: LogLevelName, entry: string): void {
  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
}
```

This function sends the final log entry to the terminal.

Why the logger does not always use `console.log(...)`:

- errors belong on `console.error(...)`
- warnings belong on `console.warn(...)`
- normal logs can use `console.log(...)`

That keeps console behavior semantically correct and compatible with environments
that distinguish stdout and stderr.

## Runtime Flow: What Happens When Code Calls `logger.info(...)`

Suppose some file does this:

```ts
const logger = getLogger("index");
logger.info("Application startup", { port: 3000 });
```

Here is the flow:

1. `getLogger("index")` returns an object with `info`, `warn`, `error`, and `debug` methods.
2. `logger.info(...)` calls `getManager().write("info", "index", "Application startup", { port: 3000 })`.
3. `getManager()` returns the active `LoggerManager`.
4. `write(...)` checks whether `info` passes the configured threshold.
5. If accepted, `formatEntry(...)` creates the final log string.
6. If the console threshold allows it, the entry goes to the terminal.
7. If file logging is enabled, the entry goes to `writeToFile(...)`.
8. `writeToFile(...)` checks whether rotation is needed first.
9. The final line is appended to the active log file.

This is the core pipeline of the logger.

## Runtime Flow: What Happens During Rotation

Suppose:

- `app.log` is almost `5 MB`
- a new log line comes in
- appending it would exceed the limit

Then the logger:

1. calculates the new line's byte size
2. checks the current file size
3. sees the limit would be exceeded
4. deletes the oldest retained backup if needed
5. shifts `app.log.2` to `app.log.3`
6. shifts `app.log.1` to `app.log.2`
7. renames `app.log` to `app.log.1`
8. appends the new entry into a fresh new `app.log`

That is the complete rotation behavior.

## Final Mental Model

You can think of `src/logging/logger.ts` as the logging machinery underneath the whole backend.

`src/index.ts` decides:

- when to configure logging
- which config values to use

But `src/logging/logger.ts` decides:

- whether a message should be emitted
- how it is formatted
- where it is written
- when it should be rotated
- how metadata is cleaned up

So if `src/index.ts` is the conductor for the backend lifecycle, `src/logging/logger.ts` is the engine that makes logging behavior actually happen.
