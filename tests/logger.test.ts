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
