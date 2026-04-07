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

// Auto-create tables on first run (uses better-sqlite3 .exec, not child_process)
const autoMigrate = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_password_hash TEXT,
    session_secret TEXT,
    llm_provider TEXT NOT NULL DEFAULT 'openai',
    llm_base_url TEXT,
    llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    llm_api_key TEXT,
    github_token TEXT,
    ui_locale TEXT NOT NULL DEFAULT 'zh-TW',
    ui_theme TEXT DEFAULT 'system',
    is_initialized INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    source_path TEXT,
    default_branch TEXT,
    file_tree_json TEXT,
    latest_run_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_analyzed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    llm_provider TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    mermaid_code TEXT,
    explanation_markdown TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_cost_usd REAL,
    error_message TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS agent_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    tool_name TEXT,
    tool_input_json TEXT,
    tool_output_json TEXT,
    llm_content TEXT,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS module_summaries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_path TEXT NOT NULL,
    summary_markdown TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`;
sqlite.exec(autoMigrate);

// Incremental migrations for new columns
const migrations = [
  "ALTER TABLE projects ADD COLUMN commit_sha TEXT",
  "ALTER TABLE analysis_runs ADD COLUMN branch TEXT",
  "ALTER TABLE analysis_runs ADD COLUMN commit_sha TEXT",
  "ALTER TABLE analysis_runs ADD COLUMN file_tree_snapshot TEXT",
];
for (const sql of migrations) {
  try {
    sqlite.exec(sql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("duplicate column")) {
      console.error(`[RepoLens] Migration failed: ${sql}`, err);
      throw err;
    }
  }
}

// Reset admin: set RESET_ADMIN=true in .env, restart, then remove the variable
if (process.env.RESET_ADMIN === "true") {
  sqlite.exec(`
    UPDATE settings SET is_initialized = 0, admin_password_hash = NULL;
    DELETE FROM sessions;
  `);
  console.log("[RepoLens] Admin reset complete. Remove RESET_ADMIN from .env and restart.");
}

// Clean up stale runs on production startup
if (process.env.NODE_ENV === "production") {
  sqlite
    .prepare(
      `UPDATE analysis_runs SET status = 'failed', error_message = 'Server restarted during analysis' WHERE status = 'running'`,
    )
    .run();
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
