import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import type { ProjectSource } from "./types";
import { getSettings } from "../db/queries";
import { decryptIfNeeded } from "../../lib/crypto";
import { createModuleLogger } from "../logger";

const log = createModuleLogger("sources");

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

async function getCurrentBranch(repoDir: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git", ["-C", repoDir, "rev-parse", "--abbrev-ref", "HEAD"], { timeout: 5000 }
    );
    return stdout.trim();
  } catch (err) {
    log.warn({ err, repoDir }, "Failed to get current branch");
    return "HEAD";
  }
}

async function getHeadCommitSha(repoDir: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git", ["-C", repoDir, "rev-parse", "HEAD"], { timeout: 5000 }
    );
    return stdout.trim();
  } catch (err) {
    log.warn({ err, repoDir }, "Failed to get HEAD commit SHA");
    return "";
  }
}

// Branch list cache (TTL 30s)
const globalForBranchCache = globalThis as unknown as {
  __repolens_branch_cache?: Map<string, { branches: string[]; defaultBranch: string; ts: number }>;
};
const branchCache = globalForBranchCache.__repolens_branch_cache ??= new Map();
if (process.env.NODE_ENV !== "production") {
  globalForBranchCache.__repolens_branch_cache = branchCache;
}

export async function listRemoteBranches(
  url: string,
  token?: string | null,
): Promise<{ branches: string[]; defaultBranch: string }> {
  const { owner, repo } = parseGitHubUrl(url);
  const cacheKey = `${owner}/${repo}`;
  const cached = branchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30000) {
    return { branches: cached.branches, defaultBranch: cached.defaultBranch };
  }

  let lsUrl = `https://github.com/${owner}/${repo}.git`;
  if (token) {
    lsUrl = `https://${token}@github.com/${owner}/${repo}.git`;
  }

  // Get branches
  const { stdout } = await execFileAsync(
    "git", ["ls-remote", "--heads", lsUrl], { timeout: 30000 }
  );

  const branches = stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/.*refs\/heads\//, ""));

  // Get default branch (HEAD ref)
  let defaultBranch = "main";
  try {
    const { stdout: headOut } = await execFileAsync(
      "git", ["ls-remote", "--symref", lsUrl, "HEAD"], { timeout: 10000 }
    );
    const match = headOut.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    if (match?.[1]) defaultBranch = match[1];
  } catch { /* fallback */ }

  const result = { branches, defaultBranch };
  branchCache.set(cacheKey, { ...result, ts: Date.now() });
  return result;
}

// Validate branch name to prevent git argument injection
function isValidBranchName(name: string): boolean {
  return /^[\w.\-/]+$/.test(name) && !name.startsWith("-");
}

export async function cloneOrPullRepo(
  url: string,
  token?: string | null,
  branch?: string | null,
): Promise<ProjectSource> {
  if (branch && !isValidBranchName(branch)) {
    throw new Error(`Invalid branch name: ${branch}`);
  }

  const { owner, repo } = parseGitHubUrl(url);
  const repoDir = path.join(REPOS_DIR, `${owner}_${repo}`);

  fs.mkdirSync(REPOS_DIR, { recursive: true });

  let cloneUrl = `https://github.com/${owner}/${repo}.git`;
  if (token) {
    cloneUrl = `https://${token}@github.com/${owner}/${repo}.git`;
  }

  log.debug({ owner, repo, branch: branch || "default", repoDir }, "Clone or pull repo");

  try {
    if (fs.existsSync(path.join(repoDir, ".git"))) {
      // Repo exists
      const currentBranch = await getCurrentBranch(repoDir);
      if (!branch || branch === currentBranch) {
        // Path 2: same branch — fetch + reset
        await execFileAsync("git", ["-C", repoDir, "fetch", "origin", "--depth", "1"], { timeout: 60000 });
        const targetBranch = branch || currentBranch;
        if (targetBranch !== "HEAD") {
          await execFileAsync("git", ["-C", repoDir, "reset", "--hard", `origin/${targetBranch}`], { timeout: 30000 });
        }
      } else {
        // Path 3: different branch — fetch specific branch + checkout with local ref
        await execFileAsync("git", ["-C", repoDir, "fetch", "origin", "--", branch, "--depth", "1"], { timeout: 60000 });
        await execFileAsync("git", ["-C", repoDir, "checkout", "-B", branch, "FETCH_HEAD"], { timeout: 30000 });
      }
    } else {
      // Path 1: fresh clone
      const cloneArgs = ["clone", "--depth", "1"];
      if (branch) cloneArgs.push("--branch", branch);
      cloneArgs.push(cloneUrl, repoDir);
      await execFileAsync("git", cloneArgs, { timeout: 120000 });
    }
  } catch (err) {
    // Log original error before destructive fallback
    log.error({ err, owner, repo }, "git operation failed, falling back to re-clone");
    fs.rmSync(repoDir, { recursive: true, force: true });
    const cloneArgs = ["clone", "--depth", "1"];
    if (branch) cloneArgs.push("--branch", branch);
    cloneArgs.push(cloneUrl, repoDir);
    await execFileAsync("git", cloneArgs, { timeout: 120000 });
  }

  // Get branch name
  let defaultBranch = branch || "main";
  try {
    const { stdout } = await execFileAsync(
      "git", ["-C", repoDir, "rev-parse", "--abbrev-ref", "HEAD"], { timeout: 5000 }
    );
    const parsed = stdout.trim();
    defaultBranch = parsed === "HEAD" ? (branch || "main") : parsed;
  } catch { /* fallback */ }

  // Get commit SHA
  const commitSha = await getHeadCommitSha(repoDir);

  log.debug({ owner, repo, branch: defaultBranch, commitSha }, "Repo ready");

  return {
    name: `${owner}/${repo}`,
    localPath: repoDir,
    defaultBranch,
    commitSha,
    sourceUrl: `https://github.com/${owner}/${repo}`,
  };
}

export async function resolveGitHubSource(url: string, branch?: string | null): Promise<ProjectSource> {
  const settings = await getSettings();
  const token = settings?.githubToken
    ? decryptIfNeeded(settings.githubToken)
    : null;
  return cloneOrPullRepo(url, token, branch);
}
