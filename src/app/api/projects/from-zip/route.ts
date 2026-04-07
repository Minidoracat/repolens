import { NextResponse } from "next/server";
import { handleZipUpload } from "~/server/sources/zip-upload";
import { buildFileTree } from "~/server/sources/local-path";
import { createProject } from "~/server/db/queries";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Only .zip files are supported" },
        { status: 400 },
      );
    }

    // 50MB limit
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 50MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const source = await handleZipUpload(buffer, file.name);
    const fileTree = buildFileTree(source.localPath);

    const projectId = await createProject({
      name: source.name,
      sourceType: "zip_upload",
      sourcePath: source.localPath,
      fileTreeJson: JSON.stringify(fileTree),
    });

    return NextResponse.json({ projectId, name: source.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
