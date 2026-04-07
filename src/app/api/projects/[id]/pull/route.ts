import { NextResponse } from "next/server";
import { getProject, updateProjectAfterPull, getSettings } from "~/server/db/queries";
import { cloneOrPullRepo } from "~/server/sources/github";
import { buildFileTree } from "~/server/sources/local-path";
import { decryptIfNeeded } from "~/lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.sourceUrl || !project.sourcePath) {
    return NextResponse.json(
      { error: "Project has no GitHub source" },
      { status: 400 },
    );
  }

  // Only allow pull for GitHub projects
  if (project.sourceType !== "github_public" && project.sourceType !== "github_private") {
    return NextResponse.json(
      { error: "Pull is only supported for GitHub projects" },
      { status: 400 },
    );
  }

  try {
    // Accept optional branch parameter to switch branches
    let targetBranch = project.defaultBranch;
    try {
      const body = await request.json() as { branch?: string };
      if (body.branch) targetBranch = body.branch;
    } catch {
      // No body or invalid JSON — use current branch
    }

    const settings = await getSettings();
    const token = settings?.githubToken
      ? decryptIfNeeded(settings.githubToken)
      : null;

    const source = await cloneOrPullRepo(
      project.sourceUrl,
      token,
      targetBranch,
    );

    const fileTree = buildFileTree(source.localPath);

    await updateProjectAfterPull(id, {
      fileTreeJson: JSON.stringify(fileTree),
      commitSha: source.commitSha || "",
      defaultBranch: source.defaultBranch || project.defaultBranch || "main",
    });

    return NextResponse.json({
      commitSha: source.commitSha,
      defaultBranch: source.defaultBranch,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    const message = raw.replace(/https:\/\/[^@]+@/g, "https://***@");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
