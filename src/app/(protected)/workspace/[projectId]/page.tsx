"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AgentPanel } from "~/components/workspace/agent-panel";
import { FileTree } from "~/components/workspace/file-tree";
import { CodeViewer } from "~/components/workspace/code-viewer";
import { useTranslations } from "next-intl";

// mermaid 必須 client-only — 避免 SSR 問題
const MermaidPanel = dynamic(
  () => import("~/components/workspace/mermaid-panel").then((m) => m.MermaidPanel),
  { ssr: false },
);

interface Project {
  id: string;
  name: string;
  sourceType: string;
  latestRunId: string | null;
}

interface RunData {
  run: { id: string; status: string; mermaidCode: string | null };
  steps: unknown[];
}

interface ProjectData {
  project: Project;
}

interface AnalyzeResult {
  runId: string;
}

const PANEL_LABELS = {
  agent: "Agent",
  tree: "Files",
  code: "Code",
  mermaid: "Diagram",
};

const MIN_WIDTH = 10;
const MAX_WIDTH = 60;

function ResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastX = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - lastX;
        lastX = moveEvent.clientX;
        onDrag(dx);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-zinc-800 transition-colors hover:bg-orange-500/50 active:bg-orange-500"
    />
  );
}

export default function WorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const t = useTranslations("workspace");
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Panel visibility state
  const [agentVisible, setAgentVisible] = useState(true);
  const [treeVisible, setTreeVisible] = useState(true);
  const [codeVisible, setCodeVisible] = useState(true);
  const [mermaidVisible, setMermaidVisible] = useState(true);

  // Panel widths in percent [agent, tree, code, mermaid]
  const [panelWidths, setPanelWidths] = useState([20, 20, 30, 30]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadProject() {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) { router.push("/"); return; }
      const data = (await res.json()) as ProjectData;
      setProject(data.project);

      if (data.project.latestRunId) {
        const rid = data.project.latestRunId;
        setActiveRunId(rid);
        const rRes = await fetch(`/api/runs/${rid}`);
        if (rRes.ok) {
          const rData = (await rRes.json()) as RunData;
          if (rData.run.mermaidCode) {
            setMermaidCode(rData.run.mermaidCode);
          }
        }
      }
    } catch {
      router.push("/");
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as AnalyzeResult;
      setActiveRunId(data.runId);
      setMermaidCode("");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleMermaidReady(code: string) {
    setMermaidCode(code);
  }

  const makeResizeHandler = useCallback(
    (leftIndex: number, rightIndex: number) => (deltaX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const totalWidth = container.getBoundingClientRect().width;
      const deltaPct = (deltaX / totalWidth) * 100;

      setPanelWidths((prev) => {
        const next = [...prev];
        const newLeft = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, (next[leftIndex] ?? 0) + deltaPct));
        const newRight = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, (next[rightIndex] ?? 0) - deltaPct));
        // Prevent total from changing
        if (newLeft + newRight !== (next[leftIndex] ?? 0) + (next[rightIndex] ?? 0)) {
          // clamp both sides
          const total = (next[leftIndex] ?? 0) + (next[rightIndex] ?? 0);
          const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, (next[leftIndex] ?? 0) + deltaPct));
          next[leftIndex] = clamped;
          next[rightIndex] = total - clamped;
        } else {
          next[leftIndex] = newLeft;
          next[rightIndex] = newRight;
        }
        return next;
      });
    },
    [],
  );

  // Redistribute hidden panel's width to its right neighbor (or left if last)
  function hidePanel(index: number, setVisible: (v: boolean) => void) {
    setPanelWidths((prev) => {
      const next = [...prev];
      const width = next[index] ?? 0;
      // Give width to the next visible panel, or previous
      const neighbor = index < next.length - 1 ? index + 1 : index - 1;
      next[neighbor] = (next[neighbor] ?? 0) + width;
      next[index] = 0;
      return next;
    });
    setVisible(false);
  }

  function showPanel(index: number, setVisible: (v: boolean) => void) {
    setPanelWidths((prev) => {
      const next = [...prev];
      const defaultW = 20;
      // Take width from the largest neighbor
      const neighbor = index < next.length - 1 ? index + 1 : index - 1;
      const available = next[neighbor] ?? 0;
      const give = Math.min(defaultW, available - MIN_WIDTH);
      next[neighbor] = available - give;
      next[index] = give;
      return next;
    });
    setVisible(true);
  }

  function exportMermaid() {
    if (!mermaidCode) return;
    const blob = new Blob([mermaidCode], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project?.name ?? "diagram"}.mmd`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Collapsed sidebar strip
  function CollapsedStrip({ label, onExpand }: { label: string; onExpand: () => void }) {
    return (
      <div className="flex w-5 flex-col items-center justify-start gap-2 border-r border-zinc-800 bg-zinc-900 pt-3">
        <button
          onClick={onExpand}
          className="flex h-5 w-5 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-200"
          title={`展開 ${label}`}
        >
          ▶
        </button>
        <span
          className="text-zinc-600"
          style={{ writingMode: "vertical-rl", fontSize: "10px", letterSpacing: "0.05em" }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col bg-zinc-950 text-zinc-100">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <button
          onClick={() => router.push("/")}
          className="text-zinc-500 transition-colors hover:text-zinc-200"
          title={t("backHome")}
        >
          ←
        </button>
        <span className="max-w-[200px] truncate text-base font-semibold text-zinc-200">
          {project?.name ?? t("loadingProject")}
        </span>
        {project?.sourceType && (
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-sm text-zinc-500">
            {project.sourceType}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing}
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {isAnalyzing ? t("analyzing") : t("reanalyze")}
          </button>
          <button
            onClick={exportMermaid}
            disabled={!mermaidCode}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40"
          >
            {t("exportMermaid")}
          </button>
        </div>
      </div>

      {/* Four-column resizable workspace */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left: Agent panel */}
        {agentVisible ? (
          <>
            <div
              className="flex shrink-0 flex-col bg-zinc-900"
              style={{ width: `${panelWidths[0]}%` }}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                <span className="text-base font-semibold text-zinc-300">{PANEL_LABELS.agent}</span>
                <button
                  onClick={() => hidePanel(0, setAgentVisible)}
                  className="text-zinc-600 transition-colors hover:text-zinc-300"
                  title="隱藏面板"
                >
                  ◀
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AgentPanel
                  projectId={projectId}
                  runId={activeRunId}
                  onMermaidReady={handleMermaidReady}
                />
              </div>
            </div>
            <ResizeHandle onDrag={makeResizeHandler(0, 1)} />
          </>
        ) : (
          <>
            <CollapsedStrip label={PANEL_LABELS.agent} onExpand={() => showPanel(0, setAgentVisible)} />
            <div className="w-px bg-zinc-800" />
          </>
        )}

        {/* Center-left: File tree */}
        {treeVisible ? (
          <>
            <div
              className="flex shrink-0 flex-col bg-zinc-900"
              style={{ width: `${panelWidths[1]}%` }}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                <span className="text-base font-semibold text-zinc-300">{PANEL_LABELS.tree}</span>
                <button
                  onClick={() => hidePanel(1, setTreeVisible)}
                  className="text-zinc-600 transition-colors hover:text-zinc-300"
                  title="隱藏面板"
                >
                  ◀
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FileTree
                  projectId={projectId}
                  onFileSelect={setSelectedFile}
                  selectedPath={selectedFile ?? undefined}
                />
              </div>
            </div>
            <ResizeHandle onDrag={makeResizeHandler(1, 2)} />
          </>
        ) : (
          <>
            <CollapsedStrip label={PANEL_LABELS.tree} onExpand={() => showPanel(1, setTreeVisible)} />
            <div className="w-px bg-zinc-800" />
          </>
        )}

        {/* Center-right: Code viewer */}
        {codeVisible ? (
          <>
            <div
              className="flex shrink-0 flex-col bg-zinc-950"
              style={{ width: `${panelWidths[2]}%` }}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                <span className="text-base font-semibold text-zinc-300">{PANEL_LABELS.code}</span>
                <button
                  onClick={() => hidePanel(2, setCodeVisible)}
                  className="text-zinc-600 transition-colors hover:text-zinc-300"
                  title="隱藏面板"
                >
                  ◀
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CodeViewer projectId={projectId} selectedFilePath={selectedFile} />
              </div>
            </div>
            <ResizeHandle onDrag={makeResizeHandler(2, 3)} />
          </>
        ) : (
          <>
            <CollapsedStrip label={PANEL_LABELS.code} onExpand={() => showPanel(2, setCodeVisible)} />
            <div className="w-px bg-zinc-800" />
          </>
        )}

        {/* Right: Mermaid diagram */}
        {mermaidVisible ? (
          <div
            className="flex shrink-0 flex-col bg-zinc-950"
            style={{ width: `${panelWidths[3]}%` }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
              <span className="text-base font-semibold text-zinc-300">{PANEL_LABELS.mermaid}</span>
              <button
                onClick={() => hidePanel(3, setMermaidVisible)}
                className="text-zinc-600 transition-colors hover:text-zinc-300"
                title="隱藏面板"
              >
                ◀
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MermaidPanel mermaidCode={mermaidCode} />
            </div>
          </div>
        ) : (
          <CollapsedStrip label={PANEL_LABELS.mermaid} onExpand={() => showPanel(3, setMermaidVisible)} />
        )}
      </div>
    </div>
  );
}
