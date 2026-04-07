import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import type { ProjectSource } from "./types";
import { getSettings } from "../db/queries";
import { decryptIfNeeded } from "../../lib/crypto";

const execFileAsync = promisify(execFile);

const REPOS_DIR = path.resolve(process.env.REPOS_CACHE_DIR || "./data/repos");

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  isPrivate: boolean;
}

export function parseGitHubUrl(url: string): GitHubRepoInfo {
  // Support: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const cleaned = url
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const match = cleaned.match(
    /(?:https?:\/\/)?(?:github\.com\/)?([^/]+)\/([^/]+)/,
  );

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  return { owner: match[1], repo: match[2], isPrivate: false };
}

export async function cloneOrPullRepo(
  url: string,
  token?: string | null,
): Promise<ProjectSource> {
  const { owner, repo } = parseGitHubUrl(url);
  const repoDir = path.join(REPOS_DIR, `${owner}_${repo}`);

  fs.mkdirSync(REPOS_DIR, { recursive: true });

  // Build the clone URL with token if provided
  let cloneUrl = `https://github.com/${owner}/${repo}.git`;
  if (token) {
    cloneUrl = `https://${token}@github.com/${owner}/${repo}.git`;
  }

  if (fs.existsSync(path.join(repoDir, ".git"))) {
    // Pull latest
    try {
      await execFileAsync("git", ["-C", repoDir, "pull", "--ff-only"], {
        timeout: 60000,
      });
    } catch {
      // If pull fails, re-clone
      fs.rmSync(repoDir, { recursive: true, force: true });
      await execFileAsync(
        "git",
        ["clone", "--depth", "1", cloneUrl, repoDir],
        { timeout: 120000 },
      );
    }
  } else {
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", cloneUrl, repoDir],
      { timeout: 120000 },
    );
  }

  // Get default branch
  let defaultBranch = "main";
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoDir, "rev-parse", "--abbrev-ref", "HEAD"],
      { timeout: 5000 },
    );
    defaultBranch = stdout.trim();
  } catch {
    // fallback to main
  }

  return {
    name: `${owner}/${repo}`,
    localPath: repoDir,
    defaultBranch,
    sourceUrl: `https://github.com/${owner}/${repo}`,
  };
}

export async function resolveGitHubSource(url: string): Promise<ProjectSource> {
  const settings = await getSettings();
  const token = settings?.githubToken
    ? decryptIfNeeded(settings.githubToken)
    : null;

  return cloneOrPullRepo(url, token);
}
