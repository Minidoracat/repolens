import "server-only";
import { streamText } from "ai";
import { nanoid } from "nanoid";
import { getLanguageModel } from "./llm-factory";
import { AGENT_SYSTEM_PROMPT } from "./prompts";
import { listTreeTool } from "./tools/list-tree";
import { readFileTool } from "./tools/read-file";
import { grepTool } from "./tools/grep";
import { getFileStatsTool } from "./tools/get-file-stats";
import { analyzeDependenciesTool } from "./tools/analyze-dependencies";
import { summarizeModuleTool } from "./tools/summarize-module";
import { generateExplanationTool } from "./tools/generate-explanation";
import { generateMermaidTool } from "./tools/generate-mermaid";
import { validateMermaidTool } from "./tools/validate-mermaid";
import { updateRun, updateProject, insertStep } from "../db/queries";

export interface AgentStepEvent {
  type:
    | "step_started"
    | "step_finished"
    | "llm_thought"
    | "mermaid_final"
    | "run_completed"
    | "run_failed";
  stepIndex?: number;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  content?: string;
  code?: string;
  error?: string;
  runId?: string;
}

interface RunAnalysisArgs {
  projectId: string;
  projectPath: string;
  runId: string;
  onStep: (event: AgentStepEvent) => void;
  abortSignal?: AbortSignal;
}

const MAX_STEPS = 25;

export async function runAnalysis({
  projectId,
  projectPath,
  runId,
  onStep,
  abortSignal,
}: RunAnalysisArgs) {
  const model = await getLanguageModel();

  let stepIndex = 0;
  let mermaidCode: string | null = null;
  let explanation: string | null = null;

  const tools = {
    list_tree: listTreeTool(projectPath),
    read_file: readFileTool(projectPath),
    grep: grepTool(projectPath),
    get_file_stats: getFileStatsTool(projectPath),
    analyze_dependencies: analyzeDependenciesTool(projectPath),
    summarize_module: summarizeModuleTool(projectPath),
    generate_explanation: generateExplanationTool(),
    generate_mermaid: generateMermaidTool(),
    validate_mermaid: validateMermaidTool(),
  };

  try {
    const result = streamText({
      model,
      system: AGENT_SYSTEM_PROMPT,
      prompt: `Analyze the project at path: ${projectPath}\n\nFollow your action plan step by step. You MUST call generate_explanation and generate_mermaid tools before finishing.`,
      tools,
      stopWhen: ({ steps }) => steps.length >= MAX_STEPS,
      abortSignal,
      onStepFinish: async (step) => {
        const currentStep = stepIndex++;
        const now = new Date();

        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            await insertStep({
              id: nanoid(),
              runId,
              stepIndex: currentStep,
              stepType: "tool_call",
              toolName: tc.toolName,
              toolInputJson: JSON.stringify(tc.input),
              toolOutputJson: null,
              llmContent: null,
              durationMs: null,
              createdAt: now,
            });
            onStep({
              type: "step_started",
              stepIndex: currentStep,
              toolName: tc.toolName,
              input: tc.input,
            });
          }
        }

        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            const output = tr.output as Record<string, unknown>;

            // Capture mermaid and explanation from tool results
            if ("mermaid" in output && typeof output.mermaid === "string") {
              mermaidCode = output.mermaid;
              onStep({ type: "mermaid_final", code: mermaidCode });
            }
            if ("markdown" in output && typeof output.markdown === "string") {
              explanation = output.markdown;
            }

            await insertStep({
              id: nanoid(),
              runId,
              stepIndex: currentStep,
              stepType: "tool_result",
              toolName: tr.toolName,
              toolInputJson: null,
              toolOutputJson: JSON.stringify(output),
              llmContent: null,
              durationMs: null,
              createdAt: now,
            });
            onStep({
              type: "step_finished",
              stepIndex: currentStep,
              toolName: tr.toolName,
              output,
            });
          }
        }

        if (step.text) {
          await insertStep({
            id: nanoid(),
            runId,
            stepIndex: currentStep,
            stepType: "llm_response",
            toolName: null,
            toolInputJson: null,
            toolOutputJson: null,
            llmContent: step.text,
            durationMs: null,
            createdAt: now,
          });
          onStep({ type: "llm_thought", content: step.text });
        }
      },
    });

    // Consume the stream fully to ensure all steps complete
    const fullText = await result.text;
    const usage = await result.usage;

    // Update run record
    await updateRun(runId, {
      status: "completed",
      mermaidCode,
      explanationMarkdown: explanation || fullText,
      promptTokens: usage?.inputTokens,
      completionTokens: usage?.outputTokens,
      finishedAt: new Date(),
    });

    await updateProject(projectId, {
      latestRunId: runId,
      lastAnalyzedAt: new Date(),
    });

    onStep({ type: "run_completed", runId });
    return { mermaidCode, explanation: explanation || fullText };
  } catch (err) {
    console.error("[RepoLens Agent] Analysis failed:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (abortSignal?.aborted) {
      await updateRun(runId, {
        status: "cancelled",
        errorMessage: "Analysis cancelled by user",
        finishedAt: new Date(),
      });
      onStep({ type: "run_failed", error: "Analysis cancelled" });
    } else {
      await updateRun(runId, {
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
      });
      onStep({ type: "run_failed", error: errorMessage });
    }

    throw err;
  }
}
