import { tool } from "ai";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { validateProjectPath } from "../../security/path-guard";

const execFileAsync = promisify(execFile);

export const grepTool = (projectPath: string) =>
  tool({
    description:
      "Search for a pattern in project files using grep. Returns matching file paths and lines.",
    inputSchema: z.object({
      pattern: z.string().describe("Regular expression pattern to search for"),
      glob: z
        .string()
        .optional()
        .describe('File glob filter, e.g. "*.ts" or "*.py"'),
    }),
    execute: async (args) => {
      validateProjectPath(".", projectPath);

      const grepArgs = ["-rn", "--max-count=5", "-m", "50"];
      if (args.glob) {
        grepArgs.push("--include", args.glob);
      }
      grepArgs.push(args.pattern, projectPath);

      try {
        const { stdout } = await execFileAsync("grep", grepArgs, {
          timeout: 15000,
          maxBuffer: 512 * 1024,
        });

        const matches = stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => line.substring(projectPath.length + 1));

        return { matches, count: matches.length };
      } catch (err) {
        // grep exits with code 1 when there are no matches — that's normal
        const execErr = err as { code?: number; stderr?: string };
        if (execErr.code === 1) {
          return { matches: [], count: 0 };
        }
        // Real errors: surface error message to the agent
        return { matches: [], count: 0, error: execErr.stderr ?? "grep failed" };
      }
    },
  });
