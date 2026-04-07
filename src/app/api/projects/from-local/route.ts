import { NextResponse } from "next/server";
import { resolveLocalSource, buildFileTree } from "~/server/sources/local-path";
import { createProject } from "~/server/db/queries";

export async function POST(request: Request) {
  try {
    const { path: inputPath } = await request.json();

    if (!inputPath || typeof inputPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 },
      );
    }

    const source = resolveLocalSource(inputPath);
    const fileTree = buildFileTree(source.localPath);

    const projectId = await createProject({
      name: source.name,
      sourceType: "local_path",
      sourcePath: source.localPath,
      fileTreeJson: JSON.stringify(fileTree),
    });

    return NextResponse.json({ projectId, name: source.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("PathGuard") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
