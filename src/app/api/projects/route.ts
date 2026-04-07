import { NextResponse } from "next/server";
import { listProjects } from "~/server/db/queries";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[RepoLens]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
