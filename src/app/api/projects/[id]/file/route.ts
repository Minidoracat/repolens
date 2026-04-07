import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProject } from "~/server/db/queries";
import { validateProjectPath } from "~/server/security/path-guard";

export async function GET(
  request: Request,
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

  const url = new URL(request.url);
  const filePath = url.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json(
      { error: "path parameter is required" },
      { status: 400 },
    );
  }

  try {
    const resolvedPath = validateProjectPath(filePath, project.sourcePath);

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Limit file size to 1MB
    const stat = fs.statSync(resolvedPath);
    if (stat.size > 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 1MB)" },
        { status: 400 },
      );
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const ext = path.extname(resolvedPath).slice(1);

    return NextResponse.json({ content, language: ext, path: filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("PathGuard") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
