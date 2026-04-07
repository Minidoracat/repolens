import { NextResponse } from "next/server";
import { resolveGitHubSource } from "~/server/sources/github";
import { buildFileTree } from "~/server/sources/local-path";
import { createProject, getSettings } from "~/server/db/queries";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const source = await resolveGitHubSource(url);
    const fileTree = buildFileTree(source.localPath);

    const settings = await getSettings();
    const isPrivate = !!settings?.githubToken;

    const projectId = await createProject({
      name: source.name,
      sourceType: isPrivate ? "github_private" : "github_public",
      sourceUrl: source.sourceUrl,
      sourcePath: source.localPath,
      defaultBranch: source.defaultBranch,
      fileTreeJson: JSON.stringify(fileTree),
    });

    return NextResponse.json({ projectId, name: source.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
