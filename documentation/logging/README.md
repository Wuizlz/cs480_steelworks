# Logging Documentation

This folder explains the backend logging system itself: when it is initialized, how loggers are created, and how the logger behavior is validated.

## Document Map

- [BackendStartupAndShutdown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/BackendStartupAndShutdown.md)
  Explains where the backend initializes logging during service startup.
- [logger.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/logger.ts.md)
  Explains the logger engine implementation.
- [logger.test.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/logger.test.ts.md)
  Explains how the logger implementation is tested.

## Source File Map

- [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts)
  Configures logging at backend startup.
- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
  Supplies environment-driven logging settings.
- [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts)
  Implements logger creation, formatting, and file rotation.
- [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts)
  Verifies logger behavior directly.

## Example Workflow: Backend Startup

1. `npm run dev`, `npm run build && npm start`, or Docker runtime eventually reaches [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts).
2. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) reads config values from [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts).
3. [src/index.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/index.ts) calls `configureLogger(...)` from [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).
4. Other backend files call `getLogger("module.name")` from [src/logging/logger.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/logging/logger.ts).
5. The logger engine formats entries and writes them to console, and to files when file logging is enabled.

## Example Workflow: Logger Test

1. [tests/logger.test.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/tests/logger.test.ts) creates a temporary log directory.
2. It configures the logger engine with file logging enabled.
3. It writes multiple log lines through `getLogger("logger.test")`.
4. The test verifies that the logger created `app.log`, rotated old files, and formatted the log line as expected.
