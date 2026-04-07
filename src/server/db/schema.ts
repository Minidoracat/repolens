import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Settings (single row) ───────────────────────────────────────────

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // Auth
  adminPasswordHash: text("admin_password_hash"),
  sessionSecret: text("session_secret"),

  // LLM
  llmProvider: text("llm_provider", {
    enum: [
      "openai",
      "anthropic",
      "google",
      "openrouter",
      "ollama",
      "azure",
    ],
  })
    .notNull()
    .default("openai"),
  llmBaseUrl: text("llm_base_url"),
  llmModel: text("llm_model").notNull().default("gpt-4o-mini"),
  llmApiKey: text("llm_api_key"), // AES-256-GCM encrypted

  // GitHub
  githubToken: text("github_token"), // AES-256-GCM encrypted

  // UI
  uiLocale: text("ui_locale", { enum: ["zh-TW", "en"] })
    .notNull()
    .default("zh-TW"),
  uiTheme: text("ui_theme", { enum: ["light", "dark", "system"] }).default(
    "system",
  ),

  // Meta
  isInitialized: integer("is_initialized", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Projects ────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // nanoid
  name: text("name").notNull(),
  sourceType: text("source_type", {
    enum: ["github_public", "github_private", "local_path", "zip_upload"],
  }).notNull(),
  sourceUrl: text("source_url"),
  sourcePath: text("source_path"),
  defaultBranch: text("default_branch"),
  commitSha: text("commit_sha"),

  fileTreeJson: text("file_tree_json"),

  latestRunId: text("latest_run_id"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  lastAnalyzedAt: integer("last_analyzed_at", { mode: "timestamp" }),
});

// ─── Analysis Runs ───────────────────────────────────────────────────

export const analysisRuns = sqliteTable("analysis_runs", {
  id: text("id").primaryKey(), // nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "cancelled"],
  }).notNull(),

  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),

  mermaidCode: text("mermaid_code"),
  explanationMarkdown: text("explanation_markdown"),

  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalCostUsd: real("total_cost_usd"),

  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),

  branch: text("branch"),
  commitSha: text("commit_sha"),
  fileTreeSnapshot: text("file_tree_snapshot"),
});

// ─── Agent Steps ─────────────────────────────────────────────────────

export const agentSteps = sqliteTable("agent_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  stepType: text("step_type", {
    enum: ["llm_thought", "tool_call", "tool_result", "llm_response", "error"],
  }).notNull(),

  toolName: text("tool_name"),
  toolInputJson: text("tool_input_json"),
  toolOutputJson: text("tool_output_json"),
  llmContent: text("llm_content"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Module Summaries ────────────────────────────────────────────────

export const moduleSummaries = sqliteTable("module_summaries", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  modulePath: text("module_path").notNull(),
  summaryMarkdown: text("summary_markdown").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Sessions ────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // signed token
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
