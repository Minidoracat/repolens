import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DATA_DIR = process.env.DATA_DIR || "./data";
const DB_PATH = path.join(DATA_DIR, "db", "repolens.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// In dev mode, reuse the connection across hot reloads
const globalForDb = globalThis as unknown as {
  __repolens_sqlite?: InstanceType<typeof Database>;
};

const sqlite = globalForDb.__repolens_sqlite ?? new Database(DB_PATH);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__repolens_sqlite = sqlite;
}

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Clean up stale runs only in production (dev hot reloads would kill active runs)
if (process.env.NODE_ENV === "production") {
  sqlite
    .prepare(
      `UPDATE analysis_runs SET status = 'failed', error_message = 'Server restarted during analysis' WHERE status = 'running'`,
    )
    .run();
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
