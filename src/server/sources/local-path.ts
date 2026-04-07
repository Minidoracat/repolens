import fs from "fs";
import path from "path";
import { validatePath } from "../security/path-guard";
import type { FileNode, ProjectSource } from "./types";

const LOCAL_MOUNTS_DIR = path.resolve(
  process.env.DATA_DIR || "./data",
  "local-mounts",
);

const ALLOWED_ROOTS = (process.env.ALLOWED_LOCAL_PATHS ?? "")
  .split(",")
  .filter(Boolean)
  .map((p) => path.resolve(p));

// Directories to always skip when scanning
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  "target",
  "vendor",
  ".idea",
  ".vscode",
]);

const IGNORED_EXTENSIONS = new Set([
  ".pyc",
  ".pyo",
  ".class",
  ".o",
  ".so",
  ".dylib",
  ".exe",
  ".dll",
]);

export function resolveLocalSource(inputPath: string): ProjectSource {
  const resolvedPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(LOCAL_MOUNTS_DIR, inputPath);

  // Only allow LOCAL_MOUNTS_DIR and explicitly configured ALLOWED_LOCAL_PATHS
  const realPath = validatePath(resolvedPath, [LOCAL_MOUNTS_DIR, ...ALLOWED_ROOTS]);

  if (!fs.existsSync(realPath) || !fs.statSync(realPath).isDirectory()) {
    throw new Error(`Path is not a valid directory: ${inputPath}`);
  }

  const name = path.basename(realPath);

  return {
    name,
    localPath: realPath,
  };
}

export function buildFileTree(
  rootPath: string,
  relativePath: string = "",
  maxDepth: number = 5,
  currentDepth: number = 0,
): FileNode[] {
  if (currentDepth >= maxDepth) return [];

  const fullPath = path.join(rootPath, relativePath);
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(fullPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const entryRelPath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      const children = buildFileTree(
        rootPath,
        entryRelPath,
        maxDepth,
        currentDepth + 1,
      );
      nodes.push({
        name: entry.name,
        path: entryRelPath,
        type: "directory",
        children,
      });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;

      let size: number | undefined;
      try {
        size = fs.statSync(path.join(fullPath, entry.name)).size;
      } catch {
        // skip size if stat fails
      }

      nodes.push({
        name: entry.name,
        path: entryRelPath,
        type: "file",
        size,
      });
    }
  }

  // Sort: directories first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}
