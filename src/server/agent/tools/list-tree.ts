import { tool } from "ai";
import { z } from "zod";
import { buildFileTree } from "../../sources/local-path";
import { validateProjectPath } from "../../security/path-guard";

export const listTreeTool = (projectPath: string) =>
  tool({
    description:
      "List the file tree of the project or a subdirectory. Returns nested directories and files.",
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe("Subdirectory path relative to project root. Omit for root."),
      maxDepth: z
        .number()
        .optional()
        .describe("Maximum depth to traverse (default: 3)"),
    }),
    execute: async (args) => {
      const targetPath = args.path
        ? validateProjectPath(args.path, projectPath)
        : projectPath;
      const tree = buildFileTree(targetPath, "", args.maxDepth ?? 3);
      return { tree };
    },
  });
