"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureLogger = configureLogger;
exports.getLogger = getLogger;
exports.resetLoggerForTests = resetLoggerForTests;
exports.toErrorMeta = toErrorMeta;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Number.POSITIVE_INFINITY,
};
class LoggerManager {
  constructor(config) {
    this.config = config;
    this.directoryReady = false;
    this.filePath = path_1.default.join(config.logDir, config.fileName);
  }
  write(level, moduleName, message, meta) {
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
  writeToFile(entry) {
    this.ensureDirectory();
    const line = `${entry}\n`;
    const nextSize = Buffer.byteLength(line, "utf8");
    const currentSize = fs_1.default.existsSync(this.filePath)
      ? fs_1.default.statSync(this.filePath).size
      : 0;
    if (currentSize + nextSize > this.config.maxBytes) {
      this.rotateFiles();
    }
    fs_1.default.appendFileSync(this.filePath, line, "utf8");
  }
  ensureDirectory() {
    if (this.directoryReady) {
      return;
    }
    fs_1.default.mkdirSync(this.config.logDir, { recursive: true });
    this.directoryReady = true;
  }
  rotateFiles() {
    const oldestFile = `${this.filePath}.${this.config.maxFiles}`;
    if (fs_1.default.existsSync(oldestFile)) {
      fs_1.default.unlinkSync(oldestFile);
    }
    for (let index = this.config.maxFiles - 1; index >= 1; index -= 1) {
      const source = `${this.filePath}.${index}`;
      const destination = `${this.filePath}.${index + 1}`;
      if (fs_1.default.existsSync(source)) {
        fs_1.default.renameSync(source, destination);
      }
    }
    if (fs_1.default.existsSync(this.filePath)) {
      fs_1.default.renameSync(this.filePath, `${this.filePath}.1`);
    }
  }
}
let activeManager = null;
function configureLogger(config) {
  activeManager = new LoggerManager(config);
}
function getLogger(moduleName) {
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
function resetLoggerForTests() {
  activeManager = null;
}
function toErrorMeta(error) {
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
function createDefaultConfig() {
  const environment = inferEnvironment();
  return {
    environment,
    level: defaultLogLevel(environment),
    consoleLevel: defaultConsoleLevel(environment),
    logDir: path_1.default.join(process.cwd(), "logs"),
    fileName: "app.log",
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 3,
    enableFileLogging: environment !== "test",
  };
}
function getManager() {
  if (!activeManager) {
    activeManager = new LoggerManager(createDefaultConfig());
  }
  return activeManager;
}
function inferEnvironment() {
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
function defaultLogLevel(environment) {
  if (environment === "production") {
    return "info";
  }
  if (environment === "test") {
    return "warn";
  }
  return "debug";
}
function defaultConsoleLevel(environment) {
  if (environment === "production") {
    return "warn";
  }
  if (environment === "test") {
    return "error";
  }
  return "debug";
}
function formatEntry(level, moduleName, message, meta) {
  const timestamp = new Date().toISOString();
  const serializedMeta = serializeMeta(meta);
  return `${timestamp} | ${level.toUpperCase()} | ${moduleName} | ${message}${serializedMeta}`;
}
function serializeMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }
  try {
    return ` ${JSON.stringify(normalizeValue(meta))}`;
  } catch {
    return ' {"log_meta_error":"Failed to serialize metadata"}';
  }
}
function normalizeValue(value) {
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
function writeToConsole(level, entry) {
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
