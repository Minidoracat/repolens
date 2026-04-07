"use client";

import { useState, useEffect } from "react";
import { AgentLogModal } from "./agent-log-modal";
import { useTranslations } from "next-intl";

interface AgentStep {
  id: string;
  runId: string;
  stepIndex: number;
  stepType: "llm_thought" | "tool_call" | "tool_result" | "llm_response" | "error";
  toolName: string | null;
  toolInputJson: string | null;
  toolOutputJson: string | null;
  llmContent: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface AnalysisRun {
  id: string;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  llmProvider: string;
  llmModel: string;
  mermaidCode: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalCostUsd: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface AgentPanelProps {
  projectId: string;
  runId: string | null;
  onMermaidReady?: (code: string) => void;
}

const STATUS_ICON: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
  cancelled: "🚫",
};

export function AgentPanel({ projectId, runId, onMermaidReady }: AgentPanelProps) {
  const t = useTranslations("workspace");
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    void fetchRunData(runId);
  }, [runId]);

  // Poll when running
  useEffect(() => {
    if (!runId || !run || run.status !== "running") return;
    const timer = setInterval(() => void fetchRunData(runId), 2000);
    return () => clearInterval(timer);
  }, [runId, run]);

  async function fetchRunData(id: string) {
    try {
      const res = await fetch(`/api/runs/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { run: AnalysisRun; steps: AgentStep[] };
      setRun(data.run);
      setSteps(data.steps);

      if (data.run.mermaidCode && onMermaidReady) {
        onMermaidReady(data.run.mermaidCode);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function fetchLatestRun() {
    try {
      const res = await fetch(`/api/projects/${projectId}/runs`);
      if (!res.ok) return;
      const data = (await res.json()) as { runs: AnalysisRun[] };
      const latest = data.runs[0];
      if (latest) {
        setRun(latest);
        void fetchRunData(latest.id);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!runId) {
      void fetchLatestRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, runId]);

  const toolSteps = steps.filter(
    (s) => s.stepType === "tool_call" || s.stepType === "tool_result" || s.stepType === "error",
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header — now rendered by parent page, but keep status line */}
      <div className="border-b border-zinc-800 px-4 py-2">
        {run && (
          <p className="text-sm text-zinc-500">
            {STATUS_ICON[run.status]} {run.status} · {run.llmModel}
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && steps.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-zinc-800" />
            ))}
          </div>
        ) : toolSteps.length === 0 ? (
          <p className="text-center text-sm text-zinc-600">
            {run ? t("waitingSteps") : t("noSteps")}
          </p>
        ) : (
          <div className="space-y-1">
            {toolSteps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-800"
              >
                <span className="text-zinc-500">#{step.stepIndex}</span>
                <span className="flex-1 truncate text-zinc-300">
                  {step.toolName ?? step.stepType}
                </span>
                <span>
                  {step.stepType === "error"
                    ? "❌"
                    : step.stepType === "tool_result"
                    ? "✅"
                    : "🔧"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        {run && (
          <div className="text-sm text-zinc-500 space-y-0.5">
            {run.promptTokens != null && (
              <p>{t("inputTokens")}：{run.promptTokens.toLocaleString()}</p>
            )}
            {run.completionTokens != null && (
              <p>{t("outputTokens")}：{run.completionTokens.toLocaleString()}</p>
            )}
            {run.totalCostUsd != null && (
              <p>{t("costLabel")}：${run.totalCostUsd.toFixed(4)}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {t("viewFullLog")}
        </button>
      </div>

      {showModal && (
        <AgentLogModal
          steps={steps}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
