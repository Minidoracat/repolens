"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SseEvent } from "~/features/runs/types";

interface AgentStep {
  stepIndex: number;
  toolName?: string;
  type: "tool_call" | "tool_result" | "llm_thought";
  input?: unknown;
  output?: unknown;
  content?: string;
}

interface UseAgentStreamResult {
  steps: AgentStep[];
  mermaidCode: string | null;
  isRunning: boolean;
  error: string | null;
}

export function useAgentStream(runId: string | null): UseAgentStreamResult {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;

    setIsRunning(true);
    setError(null);

    const es = new EventSource(`/api/runs/${runId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SseEvent;

        switch (data.type) {
          case "step_started":
            setSteps((prev) => [
              ...prev,
              {
                stepIndex: data.stepIndex ?? prev.length,
                toolName: data.toolName,
                type: "tool_call",
                input: data.input,
              },
            ]);
            break;

          case "step_finished":
            setSteps((prev) => [
              ...prev,
              {
                stepIndex: data.stepIndex ?? prev.length,
                toolName: data.toolName,
                type: "tool_result",
                output: data.output,
              },
            ]);
            break;

          case "llm_thought":
            setSteps((prev) => [
              ...prev,
              {
                stepIndex: prev.length,
                type: "llm_thought",
                content: data.content,
              },
            ]);
            break;

          case "mermaid_final":
            if (data.code) setMermaidCode(data.code);
            break;

          case "run_completed":
            setIsRunning(false);
            es.close();
            break;

          case "run_failed":
            setIsRunning(false);
            setError(data.error || "Analysis failed");
            es.close();
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setTimeout(() => {
        if (es.readyState === EventSource.CLOSED) {
          setIsRunning(false);
          setError("Connection lost. Try refreshing the page.");
        }
      }, 5000);
    };
  }, [runId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { steps, mermaidCode, isRunning, error };
}
