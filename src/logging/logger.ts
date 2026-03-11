import fs from "fs";
import path from "path";

export type EnvironmentName = "development" | "test" | "production";
export type LogLevelName = "debug" | "info" | "warn" | "error" | "silent";
export type LogMeta = Record<string, unknown>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

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

const LEVELS: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Number.POSITIVE_INFINITY,
};

class LoggerManager {
  private readonly filePath: string;
  private directoryReady = false;

  constructor(private readonly config: LoggerConfig) {
    this.filePath = path.join(config.logDir, config.fileName);
  }

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

  private ensureDirectory(): void {
    if (this.directoryReady) {
      return;
    }

    fs.mkdirSync(this.config.logDir, { recursive: true });
    this.directoryReady = true;
  }

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
}

let activeManager: LoggerManager | null = null;

export function configureLogger(config: LoggerConfig): void {
  activeManager = new LoggerManager(config);
}

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

export function resetLoggerForTests(): void {
  activeManager = null;
}

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

function getManager(): LoggerManager {
  if (!activeManager) {
    activeManager = new LoggerManager(createDefaultConfig());
  }

  return activeManager;
}

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

function defaultLogLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "info";
  }

  if (environment === "test") {
    return "warn";
  }

  return "debug";
}

function defaultConsoleLevel(environment: EnvironmentName): LogLevelName {
  if (environment === "production") {
    return "warn";
  }

  if (environment === "test") {
    return "error";
  }

  return "debug";
}

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
