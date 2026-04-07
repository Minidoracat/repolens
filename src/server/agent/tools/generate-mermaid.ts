import { tool, streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "../llm-factory";

export const generateMermaidTool = () =>
  tool({
    description:
      "Generate a Mermaid diagram from the architecture explanation and file tree. Output valid Mermaid flowchart syntax.",
    inputSchema: z.object({
      explanation: z.string().describe("Architecture explanation markdown"),
      fileTree: z.string().describe("Project file tree summary"),
    }),
    execute: async (args) => {
      const model = await getLanguageModel();

      const result = streamText({
        model,
        prompt: `Based on the following architecture explanation and file tree, generate a Mermaid flowchart diagram.

Rules:
- Use "graph TD" (top-down) direction
- Group related components into subgraphs
- Use meaningful node IDs (not generic A, B, C)
- Add click handlers for real file paths: click NodeId "path/to/file"
- Keep it readable: max 30 nodes, max 50 edges
- Use proper Mermaid syntax (no errors)
- Use classDef for styling different layers

Architecture:
${args.explanation}

File Tree:
${args.fileTree}

Output ONLY the Mermaid code, no markdown fences, no explanation.`,
      });

      let mermaid = (await result.text).trim();
      if (mermaid.startsWith("```")) {
        mermaid = mermaid.replace(/^```(?:mermaid)?\n?/, "").replace(/\n?```$/, "");
      }

      return { mermaid };
    },
  });
