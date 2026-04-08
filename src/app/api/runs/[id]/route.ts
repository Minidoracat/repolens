import { NextResponse } from "next/server";
import { getRun, listStepsByRun } from "~/server/db/queries";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const run = await getRun(id);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const steps = await listStepsByRun(id);
    return NextResponse.json({ run, steps });
  } catch (err) {
    log.error({ err }, "Failed to get run");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
