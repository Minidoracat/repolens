"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslations } from "next-intl";

export interface AgentStep {
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

interface AgentLogModalProps {
  steps: AgentStep[];
  onClose: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch {
    return "";
  }
}

function StepItem({ step }: { step: AgentStep }) {
  const t = useTranslations("agentLog");
  const [expanded, setExpanded] = useState(false);

  const STEP_TYPE_LABEL: Record<string, string> = {
    llm_thought: t("llmThought"),
    tool_call: t("toolCall"),
    tool_result: t("toolResult"),
    llm_response: t("llmResponse"),
    error: t("error"),
  };

  const hasDetails = step.toolInputJson || step.toolOutputJson || step.llmContent;

  return (
    <div className="rounded border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
        disabled={!hasDetails}
      >
        <span className="text-zinc-500 text-sm w-8">#{step.stepIndex}</span>
        <span className="text-xs rounded px-1.5 py-0.5 bg-zinc-800 text-zinc-400">
          {STEP_TYPE_LABEL[step.stepType] ?? step.stepType}
        </span>
        {step.toolName && (
          <span className="text-sm text-zinc-200 font-medium">{step.toolName}</span>
        )}
        <span className="ml-auto text-xs text-zinc-600 font-mono">{formatTime(step.createdAt)}</span>
        {step.durationMs != null && (
          <span className="text-xs text-zinc-600">{step.durationMs}ms</span>
        )}
        {hasDetails && (
          <span className="text-zinc-600 text-xs ml-1">{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3 bg-zinc-950">
          {step.toolInputJson && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">{t("input")}</p>
              <pre className="text-xs text-zinc-300 bg-zinc-900 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {(() => {
                  try { return JSON.stringify(JSON.parse(step.toolInputJson), null, 2); }
                  catch { return step.toolInputJson; }
                })()}
              </pre>
            </div>
          )}
          {step.toolOutputJson && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">{t("output")}</p>
              <pre className="text-xs text-zinc-300 bg-zinc-900 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {(() => {
                  try { return JSON.stringify(JSON.parse(step.toolOutputJson), null, 2); }
                  catch { return step.toolOutputJson; }
                })()}
              </pre>
            </div>
          )}
          {step.llmContent && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">{t("llmContent")}</p>
              <pre className="text-xs text-zinc-300 bg-zinc-900 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {step.llmContent}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentLogModal({ steps, onClose }: AgentLogModalProps) {
  const t = useTranslations("agentLog");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {steps.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">{t("noSteps")}</p>
          ) : (
            steps.map((step) => <StepItem key={step.id} step={step} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
