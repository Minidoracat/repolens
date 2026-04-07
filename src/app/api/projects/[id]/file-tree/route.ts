import { NextResponse } from "next/server";
import { getProject } from "~/server/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const fileTree = project.fileTreeJson
    ? JSON.parse(project.fileTreeJson)
    : [];

  return NextResponse.json({ fileTree });
}
