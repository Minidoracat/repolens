import { NextResponse } from "next/server";
import { getProject, listRunsByProject } from "~/server/db/queries";

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
    console.error("[RepoLens]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
