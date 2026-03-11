# Logging Integrations

This folder documents the backend files that are not the logger engine itself,
but that configure it or call it.

## Document Map

Use this folder to understand how logging moves through the application:

- [config.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/config.ts.md)
- [app.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/app.ts.md)
- [pool.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/pool.ts.md)
- [reportService.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/reportService.ts.md)
- [ingestService.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/ingestService.ts.md)
- [jobRoutes.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/jobRoutes.ts.md)
- [reportRoutes.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging-integrations/reportRoutes.ts.md)

The logger-engine docs remain in:

- [documentation/logging/BackendStartupAndShutdown.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/BackendStartupAndShutdown.md)
- [documentation/logging/logger.ts.md](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/documentation/logging/logger.ts.md)

## Source File Map

- [src/config.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/config.ts)
  Builds logging configuration from environment values.
- [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts)
  Logs HTTP request completion and unhandled request errors.
- [src/db/pool.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/pool.ts)
  Logs database pool lifecycle and asynchronous pool errors.
- [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts)
  Logs invalid reporting requests at the route boundary.
- [src/routes/jobRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/jobRoutes.ts)
  Logs process-job request intent and bad inputs.
- [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts)
  Logs reporting query start/completion/failure.
- [src/services/ingestService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/ingestService.ts)
  Logs batch ingestion progress, exclusions, and failure context.

## Example Workflow: `GET /reports/weekly-summary`

This request shows how logging moves through multiple layers.

1. The request enters [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts), which attaches the request-completion logging middleware.
2. [src/routes/reportRoutes.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/routes/reportRoutes.ts) validates `start_week` and `end_week`.
3. If the dates are invalid, the route logs a warning and returns `400`.
4. If the dates are valid, the route calls [src/services/reportService.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/services/reportService.ts).
5. The service logs query start, runs SQL from [src/db/queries.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/db/queries.ts), then logs completion or failure.
6. After the response finishes, [src/app.ts](/Users/wuzi/Desktop/Practicum_in_CS/Markdown-demo/src/app.ts) logs the final HTTP status and duration.

That gives you three useful logging layers:

- route validation logs
- service/query logs
- final HTTP access log
