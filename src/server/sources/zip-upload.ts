import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { ProjectSource } from "./types";

const execFileAsync = promisify(execFile);

const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR || "./data/uploads",
);

/**
 * Handles a zip file upload: saves to disk, extracts, returns project source.
 */
export async function handleZipUpload(
  fileBuffer: Buffer,
  originalName: string,
): Promise<ProjectSource> {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const uploadId = nanoid();
  const zipPath = path.join(UPLOADS_DIR, `${uploadId}.zip`);
  const extractDir = path.join(UPLOADS_DIR, uploadId);

  // Write the zip file
  fs.writeFileSync(zipPath, fileBuffer);

  // Extract using system unzip
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await execFileAsync("unzip", ["-o", "-q", zipPath, "-d", extractDir], {
      timeout: 60000,
    });
  } catch (err) {
    // Clean up on failure
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw new Error(`Failed to extract zip file: ${err}`);
  }

  // Clean up the zip file after extraction
  fs.rmSync(zipPath, { force: true });

  // Check for symlinks (security: prevent symlink attacks)
  const { stdout: symlinkOut } = await execFileAsync(
    "find",
    [extractDir, "-type", "l"],
    { timeout: 10000 },
  );
  if (symlinkOut.trim()) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw new Error("Archive contains symlinks, which are not permitted");
  }

  // Check decompressed size (max 500MB — zip bomb protection)
  const { stdout: duOut } = await execFileAsync(
    "du",
    ["-sb", extractDir],
    { timeout: 10000 },
  );
  const extractedSize = parseInt(duOut.split("\t")[0] ?? "0", 10);
  if (extractedSize > 500 * 1024 * 1024) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw new Error("Extracted archive exceeds 500MB limit");
  }

  // If extraction created a single subdirectory, use that as root
  const entries = fs.readdirSync(extractDir);
  let projectRoot = extractDir;

  if (entries.length === 1) {
    const singleEntry = path.join(extractDir, entries[0]!);
    if (fs.statSync(singleEntry).isDirectory()) {
      projectRoot = singleEntry;
    }
  }

  const name = originalName.replace(/\.zip$/i, "") || uploadId;

  return {
    name,
    localPath: projectRoot,
  };
}

/**
 * Clean up an uploaded project's files.
 */
export function cleanupUpload(uploadId: string): void {
  const extractDir = path.join(UPLOADS_DIR, uploadId);
  const zipPath = path.join(UPLOADS_DIR, `${uploadId}.zip`);

  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
}
