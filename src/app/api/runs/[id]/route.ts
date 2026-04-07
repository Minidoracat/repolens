import { NextResponse } from "next/server";
import { getRun, listStepsByRun } from "~/server/db/queries";

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
    console.error("[RepoLens]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
