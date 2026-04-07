import { tool, streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "../llm-factory";

export const generateExplanationTool = () =>
  tool({
    description:
      "Generate a markdown architecture explanation for the project based on gathered context (file tree, dependencies, key files).",
    inputSchema: z.object({
      context: z
        .string()
        .describe(
          "Collected context about the project: file tree summary, dependencies, key file contents, module summaries",
        ),
    }),
    execute: async (args) => {
      const model = await getLanguageModel();

      const result = streamText({
        model,
        prompt: `Based on the following project context, write a clear, well-structured architecture explanation in Markdown. Include:
1. Project overview (what it does)
2. Tech stack
3. Architecture layers / modules
4. Data flow
5. Key design patterns

Context:
${args.context}`,
      });

      const text = await result.text;
      return { markdown: text };
    },
  });
