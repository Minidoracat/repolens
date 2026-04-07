import { NextResponse } from "next/server";
import { getRun, updateRun } from "~/server/db/queries";
import { activeRuns } from "~/app/api/projects/[id]/analyze/route";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;

  const run = await getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "running") {
    return NextResponse.json(
      { error: `Run is not active (status: ${run.status})` },
      { status: 400 },
    );
  }

  // Abort the in-progress analysis if still running
  const controller = activeRuns.get(runId);
  if (controller) {
    controller.abort();
    activeRuns.delete(runId);
  }

  await updateRun(runId, {
    status: "cancelled",
    errorMessage: "Cancelled by user",
    finishedAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
