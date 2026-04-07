import { getRun, listStepsByRun } from "~/server/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params;

  const run = await getRun(runId);
  if (!run) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  let pollInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type, ...data as object })}\n\n`),
        );
      };

      // Send all existing steps first (replay for reconnection)
      const existingSteps = await listStepsByRun(runId);
      for (const step of existingSteps) {
        if (step.stepType === "tool_call") {
          sendEvent("step_started", {
            stepIndex: step.stepIndex,
            toolName: step.toolName,
            input: step.toolInputJson ? JSON.parse(step.toolInputJson) : null,
          });
        } else if (step.stepType === "tool_result") {
          sendEvent("step_finished", {
            stepIndex: step.stepIndex,
            toolName: step.toolName,
            output: step.toolOutputJson ? JSON.parse(step.toolOutputJson) : null,
          });
        } else if (step.stepType === "llm_response") {
          sendEvent("llm_thought", { content: step.llmContent });
        }
      }

      // If run is already completed/failed, send final event and close
      if (run.status === "completed") {
        sendEvent("run_completed", { runId });
        controller.close();
        return;
      }
      if (run.status === "failed" || run.status === "cancelled") {
        sendEvent("run_failed", { error: run.errorMessage });
        controller.close();
        return;
      }

      // Poll for new steps while the run is active
      let lastStepCount = existingSteps.length;
      pollInterval = setInterval(async () => {
        try {
          const currentRun = await getRun(runId);
          if (!currentRun) {
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          const steps = await listStepsByRun(runId);
          // Send new steps
          for (let i = lastStepCount; i < steps.length; i++) {
            const step = steps[i]!;
            if (step.stepType === "tool_call") {
              sendEvent("step_started", {
                stepIndex: step.stepIndex,
                toolName: step.toolName,
                input: step.toolInputJson ? JSON.parse(step.toolInputJson) : null,
              });
            } else if (step.stepType === "tool_result") {
              sendEvent("step_finished", {
                stepIndex: step.stepIndex,
                toolName: step.toolName,
                output: step.toolOutputJson ? JSON.parse(step.toolOutputJson) : null,
              });
            } else if (step.stepType === "llm_response") {
              sendEvent("llm_thought", { content: step.llmContent });
            }
          }
          lastStepCount = steps.length;

          // Check if run is done
          if (currentRun.status === "completed") {
            sendEvent("run_completed", { runId });
            sendEvent("mermaid_final", { code: currentRun.mermaidCode });
            clearInterval(pollInterval);
            controller.close();
          } else if (
            currentRun.status === "failed" ||
            currentRun.status === "cancelled"
          ) {
            sendEvent("run_failed", { error: currentRun.errorMessage });
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (err) {
          console.error("[RepoLens] SSE polling error:", err);
          try { sendEvent("run_failed", { error: "Stream error" }); } catch { /* ignore */ }
          clearInterval(pollInterval);
          controller.close();
        }
      }, 1000);
    },
    cancel() {
      if (pollInterval) clearInterval(pollInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
