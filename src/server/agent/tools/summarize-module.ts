import { tool, streamText } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { validateProjectPath } from "../../security/path-guard";
import { getLanguageModel } from "../llm-factory";

export const summarizeModuleTool = (projectPath: string) =>
  tool({
    description:
      "Generate an AI summary of a specific directory/module. Reads key files and produces a markdown summary.",
    inputSchema: z.object({
      path: z.string().describe("Directory path relative to project root to summarize"),
    }),
    execute: async (args) => {
      const resolvedPath = validateProjectPath(args.path, projectPath);

      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
        return { error: `Directory not found: ${args.path}` };
      }

      // Collect key files (entry points, index files, READMEs)
      const entries = fs.readdirSync(resolvedPath);
      const keyFiles = entries.filter((f) => {
        const lower = f.toLowerCase();
        return (
          lower.startsWith("index") ||
          lower.startsWith("main") ||
          lower.startsWith("mod") ||
          lower.startsWith("readme") ||
          lower.endsWith(".md")
        );
      });

      // Read up to 3 key files, max 200 lines each
      const fileContents: string[] = [];
      for (const file of keyFiles.slice(0, 3)) {
        const filePath = path.join(resolvedPath, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n").slice(0, 200).join("\n");
          fileContents.push(`--- ${file} ---\n${lines}`);
        } catch { /* skip */ }
      }

      // Also list all files in the directory
      const allFiles = entries.filter((f) => {
        try {
          return fs.statSync(path.join(resolvedPath, f)).isFile();
        } catch { return false; }
      });

      const model = await getLanguageModel();

      const result = streamText({
        model,
        prompt: `Summarize this code module/directory in 2-3 paragraphs. Focus on purpose, key abstractions, and dependencies.

Directory: ${args.path}
Files: ${allFiles.join(", ")}

${fileContents.join("\n\n")}`,
      });

      const text = await result.text;
      return { summary: text, path: args.path };
    },
  });
