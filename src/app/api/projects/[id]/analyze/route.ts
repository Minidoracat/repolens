import { NextResponse } from "next/server";
import {
  getProject,
  getSettings,
  createRun,
} from "~/server/db/queries";
import { runAnalysis } from "~/server/agent/runtime";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

// Store active AbortControllers for cancel support
const activeRuns = new Map<string, AbortController>();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.sourcePath) {
    return NextResponse.json(
      { error: "Project has no source path" },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  if (!settings) {
    return NextResponse.json(
      { error: "Settings not initialized" },
      { status: 400 },
    );
  }

  log.debug({ projectId: id, provider: settings.llmProvider, model: settings.llmModel }, "Starting analysis run");

  const runId = await createRun({
    projectId: id,
    status: "running",
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
    branch: project.defaultBranch,
    commitSha: project.commitSha,
    startedAt: new Date(),
  });

  const abortController = new AbortController();
  activeRuns.set(runId, abortController);

  // Run analysis in background (non-blocking)
  runAnalysis({
    projectId: id,
    projectPath: project.sourcePath,
    runId,
    abortSignal: abortController.signal,
    onStep: () => {
      // Steps are persisted to DB by the runtime.
      // SSE streaming is handled by the /api/runs/[id]/stream endpoint.
    },
  })
    .catch((err) => {
      log.error({ err }, "Analysis background error");
    })
    .finally(() => {
      activeRuns.delete(runId);
    });

  return NextResponse.json({ runId });
}

// Export for cancel endpoint
export { activeRuns };
