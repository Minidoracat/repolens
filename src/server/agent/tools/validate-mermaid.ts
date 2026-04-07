import { tool } from "ai";
import { z } from "zod";

export const validateMermaidTool = () =>
  tool({
    description:
      "Validate Mermaid diagram syntax. Returns whether the syntax is valid and any error messages.",
    inputSchema: z.object({
      mermaid: z.string().describe("Mermaid diagram code to validate"),
    }),
    execute: async (args) => {
      try {
        // Basic syntax validation without full DOM rendering
        const code = args.mermaid.trim();

        // Check for required diagram type declaration
        const validTypes = [
          "graph", "flowchart", "sequenceDiagram", "classDiagram",
          "stateDiagram", "erDiagram", "gantt", "pie", "gitgraph",
          "mindmap", "timeline", "C4Context",
        ];

        const firstLine = code.split("\n")[0]?.trim() || "";
        const hasValidType = validTypes.some((t) =>
          firstLine.startsWith(t),
        );

        if (!hasValidType) {
          return {
            valid: false,
            errors: [`Invalid diagram type. First line: "${firstLine}". Expected one of: ${validTypes.join(", ")}`],
          };
        }

        // Check for balanced brackets/parentheses
        const brackets: Record<string, number> = { "[": 0, "(": 0, "{": 0 };
        const closing: Record<string, string> = { "]": "[", ")": "(", "}": "{" };

        for (const char of code) {
          if (char in brackets) brackets[char]!++;
          if (char in closing) brackets[closing[char]!]!--;
        }

        const unbalanced = Object.entries(brackets)
          .filter(([, count]) => count !== 0)
          .map(([bracket, count]) => `Unbalanced '${bracket}': ${count > 0 ? "missing closing" : "extra closing"}`);

        if (unbalanced.length > 0) {
          return { valid: false, errors: unbalanced };
        }

        // Check for empty diagram (no nodes)
        const lines = code.split("\n").filter((l) => l.trim() && !l.trim().startsWith("%%"));
        if (lines.length < 2) {
          return { valid: false, errors: ["Diagram appears to be empty (no nodes defined)"] };
        }

        return { valid: true, errors: [] };
      } catch (err) {
        return {
          valid: false,
          errors: [err instanceof Error ? err.message : "Unknown validation error"],
        };
      }
    },
  });
