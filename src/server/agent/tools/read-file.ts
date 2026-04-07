import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { validateProjectPath } from "../../security/path-guard";

const MAX_LINES = 500;

export const readFileTool = (projectPath: string) =>
  tool({
    description:
      "Read the contents of a file. Returns the file content, detected language, and line count.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to project root"),
      maxLines: z
        .number()
        .optional()
        .describe(`Maximum lines to read (default: ${MAX_LINES})`),
    }),
    execute: async (args) => {
      const resolvedPath = validateProjectPath(args.path, projectPath);

      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return { error: `File not found: ${args.path}` };
      }

      const stat = fs.statSync(resolvedPath);
      if (stat.size > 1024 * 1024) {
        return {
          error: `File too large (${(stat.size / 1024).toFixed(0)}KB). Max 1MB.`,
        };
      }

      const raw = fs.readFileSync(resolvedPath, "utf-8");
      const lines = raw.split("\n");
      const limit = args.maxLines ?? MAX_LINES;
      const truncated = lines.length > limit;
      const content = truncated ? lines.slice(0, limit).join("\n") : raw;
      const ext = path.extname(args.path).slice(1);

      return { content, language: ext, lines: lines.length, truncated };
    },
  });
