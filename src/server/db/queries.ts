import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import {
  settings,
  projects,
  analysisRuns,
  agentSteps,
  moduleSummaries,
  sessions,
} from "./schema";

// ─── Settings ────────────────────────────────────────────────────────

export async function getSettings() {
  const rows = db.select().from(settings).limit(1).all();
  return rows[0] ?? null;
}

export async function upsertSettings(
  data: Partial<typeof settings.$inferInsert>,
) {
  const existing = await getSettings();
  const now = new Date();

  if (existing) {
    db.update(settings)
      .set({ ...data, updatedAt: now })
      .where(eq(settings.id, existing.id))
      .run();
  } else {
    db.insert(settings)
      .values({ ...data, createdAt: now, updatedAt: now } as typeof settings.$inferInsert)
      .run();
  }
}

// ─── Projects ────────────────────────────────────────────────────────

export async function listProjects() {
  return db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
}

export async function getProject(id: string) {
  const rows = db.select().from(projects).where(eq(projects.id, id)).all();
  return rows[0] ?? null;
}

export async function createProject(
  data: Omit<typeof projects.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = nanoid();
  const now = new Date();
  db.insert(projects)
    .values({ ...data, id, createdAt: now, updatedAt: now })
    .run();
  return id;
}

export async function updateProject(
  id: string,
  data: Partial<typeof projects.$inferInsert>,
) {
  db.update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .run();
}

export async function deleteProject(id: string) {
  db.delete(projects).where(eq(projects.id, id)).run();
}

// ─── Analysis Runs ───────────────────────────────────────────────────

export async function createRun(
  data: Omit<typeof analysisRuns.$inferInsert, "id">,
) {
  const id = nanoid();
  db.insert(analysisRuns).values({ ...data, id }).run();
  return id;
}

export async function getRun(id: string) {
  const rows = db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.id, id))
    .all();
  return rows[0] ?? null;
}

export async function listRunsByProject(projectId: string) {
  return db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.projectId, projectId))
    .orderBy(desc(analysisRuns.startedAt))
    .all();
}

export async function updateRun(
  id: string,
  data: Partial<typeof analysisRuns.$inferInsert>,
) {
  db.update(analysisRuns)
    .set(data)
    .where(eq(analysisRuns.id, id))
    .run();
}

// ─── Agent Steps ─────────────────────────────────────────────────────

export async function insertStep(data: typeof agentSteps.$inferInsert) {
  db.insert(agentSteps).values(data).run();
}

export async function listStepsByRun(runId: string) {
  return db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(agentSteps.stepIndex)
    .all();
}

// ─── Module Summaries ────────────────────────────────────────────────

export async function upsertModuleSummary(
  data: Omit<typeof moduleSummaries.$inferInsert, "id">,
) {
  const id = nanoid();
  const now = new Date();
  db.insert(moduleSummaries)
    .values({ ...data, id, createdAt: now })
    .run();
  return id;
}

export async function listModuleSummaries(projectId: string) {
  return db
    .select()
    .from(moduleSummaries)
    .where(eq(moduleSummaries.projectId, projectId))
    .all();
}

// ─── Sessions ────────────────────────────────────────────────────────

export async function createSession(id: string, expiresAt: Date) {
  db.insert(sessions)
    .values({ id, expiresAt, createdAt: new Date() })
    .run();
}

export async function getSession(id: string) {
  const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
  const session = rows[0];
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }
  return session;
}

export async function deleteSession(id: string) {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}
