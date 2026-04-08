import { NextResponse } from "next/server";
import { getProject, deleteProject } from "~/server/db/queries";
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
    return NextResponse.json({ project });
  } catch (err) {
    log.error({ err }, "Failed to get project");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, "Failed to delete project");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
