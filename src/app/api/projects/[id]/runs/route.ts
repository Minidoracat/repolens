import { NextResponse } from "next/server";
import { getProject, listRunsByProject } from "~/server/db/queries";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const runs = await listRunsByProject(id);
    return NextResponse.json({ runs });
  } catch (err) {
    log.error({ err }, "Failed to get project runs");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
