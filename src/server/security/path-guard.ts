import { realpathSync, lstatSync } from "fs";
import path from "path";

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

/**
 * Validates that a user-supplied path resolves to a location within one of the
 * allowed prefixes. Prevents path traversal, symlink escape, and directory
 * breakout attacks.
 *
 * @param userPath - The raw path supplied by the user or LLM agent
 * @param allowedPrefixes - Absolute directory paths that the resolved path must fall under
 * @returns The resolved, canonicalized absolute path
 * @throws PathGuardError if the path is invalid or escapes the allowed prefixes
 */
export function validatePath(
  userPath: string,
  allowedPrefixes: string[],
): string {
  if (!userPath || typeof userPath !== "string") {
    throw new PathGuardError("Path must be a non-empty string");
  }

  if (allowedPrefixes.length === 0) {
    throw new PathGuardError("At least one allowed prefix must be specified");
  }

  // Reject paths containing null bytes (poison byte attack)
  if (userPath.includes("\0")) {
    throw new PathGuardError("Path contains null bytes");
  }

  // Reject obviously malicious patterns before filesystem access
  const normalized = path.normalize(userPath);
  if (normalized.includes("..")) {
    throw new PathGuardError(
      `Path traversal detected: "${userPath}" normalizes to "${normalized}"`,
    );
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(userPath);

  // Resolve symlinks to get the true filesystem path
  let realPath: string;
  try {
    realPath = realpathSync(absolutePath);
  } catch {
    // If the path doesn't exist yet, validate the parent directory
    const parentDir = path.dirname(absolutePath);
    try {
      const realParent = realpathSync(parentDir);
      realPath = path.join(realParent, path.basename(absolutePath));
    } catch {
      throw new PathGuardError(
        `Path does not exist and parent directory is not accessible: "${userPath}"`,
      );
    }
  }

  // Verify the resolved path falls under at least one allowed prefix
  const normalizedPrefixes = allowedPrefixes.map((p) => {
    const resolved = path.resolve(p);
    // Ensure prefix ends with separator for correct prefix matching
    return resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
  });

  const isAllowed = normalizedPrefixes.some(
    (prefix) => realPath === prefix.slice(0, -1) || realPath.startsWith(prefix),
  );

  if (!isAllowed) {
    throw new PathGuardError(
      `Path "${userPath}" resolves to "${realPath}" which is outside allowed directories`,
    );
  }

  // Additional check: if the target exists, reject symlinks pointing outside
  try {
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      const linkTarget = realpathSync(absolutePath);
      const linkAllowed = normalizedPrefixes.some(
        (prefix) =>
          linkTarget === prefix.slice(0, -1) || linkTarget.startsWith(prefix),
      );
      if (!linkAllowed) {
        throw new PathGuardError(
          `Symlink "${userPath}" points to "${linkTarget}" which is outside allowed directories`,
        );
      }
    }
  } catch (err) {
    if (err instanceof PathGuardError) throw err;
    // File doesn't exist yet — that's OK, parent was validated above
  }

  return realPath;
}

/**
 * Convenience wrapper: validates a path relative to a project's source directory.
 */
export function validateProjectPath(
  userPath: string,
  projectSourcePath: string,
): string {
  const absoluteUserPath = path.isAbsolute(userPath)
    ? userPath
    : path.join(projectSourcePath, userPath);

  return validatePath(absoluteUserPath, [projectSourcePath]);
}
