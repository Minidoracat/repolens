import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";

export const analyzeDependenciesTool = (projectPath: string) =>
  tool({
    description:
      "Analyze project dependencies by reading package.json, requirements.txt, Cargo.toml, go.mod, etc.",
    inputSchema: z.object({}),
    execute: async () => {
      const result: {
        packageManagers: string[];
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      } = {
        packageManagers: [],
        dependencies: {},
        devDependencies: {},
        scripts: {},
      };

      // Node.js
      const pkgPath = path.join(projectPath, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          result.packageManagers.push("npm/pnpm/bun");
          result.dependencies = pkg.dependencies || {};
          result.devDependencies = pkg.devDependencies || {};
          result.scripts = pkg.scripts || {};
        } catch { /* invalid JSON */ }
      }

      // Python
      const reqPath = path.join(projectPath, "requirements.txt");
      if (fs.existsSync(reqPath)) {
        result.packageManagers.push("pip");
        const lines = fs.readFileSync(reqPath, "utf-8").split("\n").filter(Boolean);
        for (const line of lines) {
          const [name] = line.split(/[>=<~!]/);
          if (name) result.dependencies[name.trim()] = line.trim();
        }
      }

      const pyprojectPath = path.join(projectPath, "pyproject.toml");
      if (fs.existsSync(pyprojectPath)) {
        result.packageManagers.push("pyproject");
      }

      // Rust
      const cargoPath = path.join(projectPath, "Cargo.toml");
      if (fs.existsSync(cargoPath)) {
        result.packageManagers.push("cargo");
      }

      // Go
      const goModPath = path.join(projectPath, "go.mod");
      if (fs.existsSync(goModPath)) {
        result.packageManagers.push("go");
      }

      return result;
    },
  });
