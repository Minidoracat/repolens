import "server-only";
import pino from "pino";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const LOG_DIR = process.env.LOG_DIR || path.join(DATA_DIR, "logs");
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || "7", 10);

// Ensure log directory exists
fs.mkdirSync(LOG_DIR, { recursive: true });

// globalThis singleton for dev HMR (參照 src/server/db/client.ts:13-21)
const globalForLogger = globalThis as unknown as {
  __repolens_logger?: pino.Logger;
};

function createLogger(): pino.Logger {
  const isDev = process.env.NODE_ENV !== "production";

  const multiTransport = pino.transport({
    targets: [
      {
        target: "pino-roll",
        options: {
          file: path.join(LOG_DIR, "app.log"),
          frequency: "daily",
          dateFormat: "yyyy-MM-dd",
          maxAgeDays: LOG_RETENTION_DAYS,
          mkdir: true,
        },
        level: LOG_LEVEL,
      },
      isDev
        ? {
            target: "pino-pretty",
            options: { colorize: true },
            level: LOG_LEVEL,
          }
        : {
            target: "pino/file",
            options: { destination: 1 },
            level: LOG_LEVEL,
          },
    ],
  });

  return pino({ level: LOG_LEVEL }, multiTransport);
}

const logger = globalForLogger.__repolens_logger ?? createLogger();

if (process.env.NODE_ENV !== "production") {
  globalForLogger.__repolens_logger = logger;
}

export default logger;

/**
 * Create a child logger with module context
 * Usage: const log = createModuleLogger("db");
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
