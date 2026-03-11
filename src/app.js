"use strict";
/**
 * Express application factory.
 *
 * The app is created with explicit dependencies to enable testing
 * with alternate database pools (e.g., pg-mem).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sentry_1 = require("./sentry");
const config_1 = require("./config");
const logger_1 = require("./logging/logger");
const jobRoutes_1 = require("./routes/jobRoutes");
const reportRoutes_1 = require("./routes/reportRoutes");
const appLogger = (0, logger_1.getLogger)("app");
const httpLogger = (0, logger_1.getLogger)("http");
/**
 * Build the Express application using the provided database pool.
 *
 * Time complexity: O(1) because it only wires middleware and routes.
 * Space complexity: O(1) because it allocates a constant number of handlers.
 */
function createApp(pool) {
    // Initialize the Express app instance.
    const app = (0, express_1.default)();
    // Parse JSON request bodies for POST endpoints.
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use((req, res, next) => {
        const startedAt = process.hrtime.bigint();
        res.on("finish", () => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
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
    // Basic health check to confirm the service is running.
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    // Mount report endpoints under /reports.
    app.use("/reports", (0, reportRoutes_1.createReportRouter)(pool));
    // Mount job endpoints under /jobs.
    app.use("/jobs", (0, jobRoutes_1.createJobRouter)(pool));
    // Serve the React build if it exists (production mode).
    const uiDistPath = path_1.default.join(process.cwd(), "frontend", "dist");
    if (fs_1.default.existsSync(uiDistPath)) {
        // Serve static frontend assets from the Vite build output.
        app.use(express_1.default.static(uiDistPath));
    }
    if (config_1.config.sentry.dsn) {
        // Sentry recommends adding this after routes and before custom error handlers.
        sentry_1.Sentry.setupExpressErrorHandler(app);
    }
    // Centralized error handler for async route failures.
    app.use((err, req, res, _next) => {
        // Log the error for server-side diagnostics.
        appLogger.error("Unhandled request error", {
            method: req.method,
            path: req.originalUrl || req.url,
            ...(0, logger_1.toErrorMeta)(err),
        });
        res.status(500).json({ error: "Internal server error" });
    });
    appLogger.info("Express application created", {
        serves_frontend: fs_1.default.existsSync(uiDistPath),
        sentry_enabled: Boolean(config_1.config.sentry.dsn),
    });
    return app;
}
