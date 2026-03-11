# Understanding `tests/logger.test.ts`

This document explains how [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts) verifies the logging system.

This test is important because it does not just check that the logger can print a
message. It checks the core behaviors that make the logger usable in practice:

- explicit logger configuration
- module-specific logger creation
- file output
- file rotation
- log formatting
- test isolation through logger reset and filesystem cleanup

If [documentation/logging/logger.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/logger.ts.md) explains how the logger is implemented, this document explains how that implementation is validated.

## Full Code

```ts
import fs from "fs";
import os from "os";
import path from "path";
import {
  configureLogger,
  getLogger,
  resetLoggerForTests,
} from "../src/logging/logger";

let logDir: string | null = null;

afterEach(() => {
  resetLoggerForTests();

  if (logDir) {
    fs.rmSync(logDir, { recursive: true, force: true });
    logDir = null;
  }
});

test("logger writes formatted entries and rotates files", () => {
  logDir = fs.mkdtempSync(path.join(os.tmpdir(), "ops-logger-"));

  configureLogger({
    environment: "development",
    level: "debug",
    consoleLevel: "silent",
    logDir,
    fileName: "app.log",
    maxBytes: 150,
    maxFiles: 3,
    enableFileLogging: true,
  });

  const logger = getLogger("logger.test");

  for (let index = 0; index < 20; index += 1) {
    logger.info(`message ${index}`, { sequence: index });
  }

  const files = fs.readdirSync(logDir).sort();
  expect(files).toContain("app.log");
  expect(files).toContain("app.log.1");
  expect(
    files.filter((name) => name.startsWith("app.log")).length,
  ).toBeLessThanOrEqual(4);

  const latestLog = fs.readFileSync(path.join(logDir, "app.log"), "utf8");
  expect(latestLog).toMatch(
    /\d{4}-\d{2}-\d{2}T.* \| INFO \| logger\.test \| message \d+ {"sequence":\d+}/,
  );
});
```

## High-Level Purpose

This test answers a very practical question:

"If I configure the logger and write many log lines, does it actually create
formatted log files and rotate them correctly?"

That is a better test than simply checking one function in isolation, because it
touches multiple real behaviors together.

## Section 1: Imports

```ts
import fs from "fs";
import os from "os";
import path from "path";
import {
  configureLogger,
  getLogger,
  resetLoggerForTests,
} from "../src/logging/logger";
```

These imports show that the test is exercising the real logger against the real filesystem.

### Why `fs`, `os`, and `path` are used

- `fs`
  creates, reads, and deletes log files and directories
- `os`
  gives access to the system temp directory
- `path`
  safely constructs paths

Why this matters:

The logger writes actual files, so the test should verify real file behavior rather than mocking everything away.

### Why `configureLogger`, `getLogger`, and `resetLoggerForTests` are imported

These are the core logger APIs being validated.

- `configureLogger(...)`
  sets the active logger manager for the test
- `getLogger(...)`
  creates a module logger that routes writes through the manager
- `resetLoggerForTests(...)`
  clears global logger state after each test

This test is therefore directly exercising the shared singleton behavior in
[src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).

## Section 2: Shared `logDir` Variable

```ts
let logDir: string | null = null;
```

This variable stores the temporary directory used by the test.

Why it exists outside the test body:

- the test needs to create the temp directory
- the cleanup hook needs to delete it afterward

So the variable is shared between:

- the test itself
- the `afterEach(...)` cleanup block

## Section 3: `afterEach(...)` Cleanup

```ts
afterEach(() => {
  resetLoggerForTests();

  if (logDir) {
    fs.rmSync(logDir, { recursive: true, force: true });
    logDir = null;
  }
});
```

This is a critical part of the test design.

It performs two kinds of cleanup:

1. logger-state cleanup
2. filesystem cleanup

### Part 1: `resetLoggerForTests();`

This clears the global `activeManager` inside `src/logging/logger.ts`.

Why this matters:

The logger uses shared module-level state.

Without resetting it, one test could leave behind:

- a configured log level
- a specific log directory
- a specific max file size

and the next test could accidentally inherit those settings.

That is called state leakage between tests.

### Part 2: Remove the temp directory

```ts
fs.rmSync(logDir, { recursive: true, force: true });
```

This deletes the temp directory and everything inside it.

Why those options matter:

- `recursive: true`
  removes the directory even if it contains files
- `force: true`
  avoids failing if something is already gone

This keeps the test isolated and prevents temp files from accumulating.

### Why `logDir = null;` is set afterward

That resets the shared variable so the next test starts with no leftover path.

## Section 4: The Test Case Itself

```ts
test("logger writes formatted entries and rotates files", () => {
  ...
});
```

The test name is good because it states the two exact behaviors being checked:

- formatted entries are written
- files rotate

That is stronger than a vague name like "logger works."

## Section 5: Create a Temporary Log Directory

```ts
logDir = fs.mkdtempSync(path.join(os.tmpdir(), "ops-logger-"));
```

This creates a unique temporary folder for this test run.

Example result:

```text
/tmp/ops-logger-abcd1234
```

Why this is helpful:

- the test does not write into the repo's normal `logs/` folder
- each run gets its own isolated directory
- the cleanup step can safely remove it afterward

This is exactly the right choice for a filesystem-based logger test.

## Section 6: Configure the Logger for the Test

```ts
configureLogger({
  environment: "development",
  level: "debug",
  consoleLevel: "silent",
  logDir,
  fileName: "app.log",
  maxBytes: 150,
  maxFiles: 3,
  enableFileLogging: true,
});
```

This is the most important setup step.

The test deliberately chooses values that make rotation easy to trigger.

### Why `environment: "development"`

This gives the logger a normal non-test environment label, but in this test the
explicit thresholds matter more than the environment itself.

### Why `level: "debug"`

This ensures that `info` messages will definitely pass the main threshold.

The test is calling `logger.info(...)`, so it does not want those messages filtered out.

### Why `consoleLevel: "silent"`

This disables console output during the test.

Why that is helpful:

- keeps test output clean
- focuses the test on file behavior
- avoids polluting the terminal with many log lines

### Why `logDir`

This points the logger at the temporary directory created earlier, not the normal app log directory.

### Why `maxBytes: 150`

This is one of the smartest parts of the test.

The production config uses `5 MB`, but that would be far too large to trigger conveniently in a unit test.

By using `150` bytes, the test can force rotation with just a handful of short log lines.

This keeps the test:

- fast
- deterministic
- easy to understand

### Why `maxFiles: 3`

This matches the real application setting, so the test is validating the same retention logic used in the app.

### Why `enableFileLogging: true`

The whole point of this test is file creation and file rotation, so file logging must be enabled.

## Section 7: Create the Module Logger

```ts
const logger = getLogger("logger.test");
```

This creates a logger instance tagged with the module name `logger.test`.

Why this matters:

The final formatting assertion later checks that the module name appears in the log line.

So this test is verifying that `getLogger(...)` is not just returning any object.
It is verifying that the module name is actually embedded into emitted logs.

## Section 8: Write Many Log Entries

```ts
for (let index = 0; index < 20; index += 1) {
  logger.info(`message ${index}`, { sequence: index });
}
```

This loop is how the test forces the logger to do real work.

Each iteration writes:

- a message string like `message 7`
- metadata like `{ sequence: 7 }`

Why loop 20 times:

- one or two lines would not force multiple writes
- many lines make it very likely that the `150` byte limit will be crossed

What this is exercising internally:

1. `getLogger("logger.test")` returns a logger object
2. `logger.info(...)` calls `getManager().write("info", "logger.test", ...)`
3. `write(...)` passes the threshold check
4. `formatEntry(...)` builds the final string
5. `writeToFile(...)` checks the size
6. `rotateFiles(...)` runs when needed
7. the final line is appended

So this simple loop actually drives a large portion of the logger implementation.

## Section 9: Check the Filesystem Result

```ts
const files = fs.readdirSync(logDir).sort();
expect(files).toContain("app.log");
expect(files).toContain("app.log.1");
expect(
  files.filter((name) => name.startsWith("app.log")).length,
).toBeLessThanOrEqual(4);
```

This block verifies the rotation outcome from the filesystem side.

### `expect(files).toContain("app.log");`

This checks that there is still a current live log file.

That matters because rotation should not leave the logger with only backups.
There must always be an active `app.log`.

### `expect(files).toContain("app.log.1");`

This checks that at least one rotation happened.

If no rotated file exists, then the test did not really prove the rotation logic.

### Why `<= 4`

```ts
files.filter((name) => name.startsWith("app.log")).length;
```

counts:

- `app.log`
- `app.log.1`
- `app.log.2`
- `app.log.3`

That is a maximum of 4 files total:

- 1 current file
- 3 backups

This assertion proves the logger does not keep more files than the configured retention policy allows.

So the test is checking both:

- rotation happened
- retention stayed bounded

## Section 10: Check the Log Format

```ts
const latestLog = fs.readFileSync(path.join(logDir, "app.log"), "utf8");
expect(latestLog).toMatch(
  /\d{4}-\d{2}-\d{2}T.* \| INFO \| logger\.test \| message \d+ {"sequence":\d+}/,
);
```

This verifies that the file contents are not just present, but formatted correctly.

### Why it reads `app.log`

The test wants to inspect the current active file and confirm that the newest format still matches expectations.

### What the regex is checking

The regular expression looks for:

- an ISO-style timestamp
- the literal level `INFO`
- the module name `logger.test`
- a message like `message 12`
- metadata like `{"sequence":12}`

So this assertion validates the formatting pipeline from:

- `formatEntry(...)`
- metadata serialization
- module-name insertion
- level-name formatting

This is the strongest content-level assertion in the test.

## Section 11: Why This Test Is Valuable

This test is valuable because it verifies multiple real behaviors together, not just one helper in isolation.

It confirms that:

- configuration reaches the logger
- a module logger can be created
- `info` logs are accepted under the configured threshold
- file logging happens
- rotation occurs when the file grows too large
- retention does not exceed the configured maximum
- output formatting matches the intended shape
- test cleanup avoids leaking global logger state

That is a strong integration-style test for the logger core.

## Relationship to the Other Logging Files

This test is especially useful because it connects directly to the behaviors documented elsewhere:

- [documentation/logging/BackendStartupAndShutdown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/BackendStartupAndShutdown.md)
  explains where the real app configures logging
- [documentation/logging/logger.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/logger.ts.md)
  explains how `configureLogger(...)`, `getLogger(...)`, `writeToFile(...)`, and `rotateFiles(...)` work internally

This test proves that those moving pieces actually work together in practice.

## Final Mental Model

You can think of `tests/logger.test.ts` as the safety check for the logger engine.

It does not test every app integration file.
It tests the core contract of the logger itself:

- can the logger be configured?
- can it emit correctly formatted file logs?
- can it rotate files correctly?
- can it clean up its shared state between tests?

That makes it one of the most important documents for understanding how the logger is validated.
