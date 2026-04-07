import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { validateProjectPath } from "../../security/path-guard";

const EXT_TO_LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", rs: "Rust", go: "Go", java: "Java", rb: "Ruby",
  php: "PHP", cs: "C#", cpp: "C++", c: "C", h: "C", swift: "Swift",
  kt: "Kotlin", vue: "Vue", svelte: "Svelte", css: "CSS", scss: "SCSS",
  html: "HTML", md: "Markdown", json: "JSON", yaml: "YAML", yml: "YAML",
  toml: "TOML", sql: "SQL", sh: "Shell", bash: "Shell", dockerfile: "Dockerfile",
};

function countFiles(
  dir: string,
  stats: { totalFiles: number; byLanguage: Record<string, number>; totalLines: number },
  depth = 0,
) {
  if (depth > 10) return;
  const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "__pycache__", "vendor"]);

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) countFiles(fullPath, stats, depth + 1);
    } else if (entry.isFile()) {
      stats.totalFiles++;
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      const lang = EXT_TO_LANG[ext] || ext || "Other";
      stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        stats.totalLines += content.split("\n").length;
      } catch { /* skip binary files */ }
    }
  }
}

export const getFileStatsTool = (projectPath: string) =>
  tool({
    description: "Get file statistics: total files, lines of code, and language breakdown.",
    inputSchema: z.object({
      path: z.string().optional().describe("Subdirectory to analyze. Omit for entire project."),
    }),
    execute: async (args) => {
      const targetPath = args.path
        ? validateProjectPath(args.path, projectPath)
        : projectPath;

      const stats = { totalFiles: 0, byLanguage: {} as Record<string, number>, totalLines: 0 };
      countFiles(targetPath, stats);

      return stats;
    },
  });
