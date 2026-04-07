"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileTreeProps {
  projectId: string;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
}

function TreeNode({ node, depth, onFileSelect, selectedPath }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-xs">{expanded ? "▼" : "▶"}</span>
          <span>📁</span>
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-800 ${
        selectedPath === node.path
          ? "bg-orange-500/20 text-orange-400"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span>📄</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ projectId, onFileSelect, selectedPath }: FileTreeProps) {
  const t = useTranslations("workspace");
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchTree() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/file-tree`);
      if (!res.ok) throw new Error("無法載入文件樹");
      const data = (await res.json()) as { fileTree: FileNode[] };
      setTree(data.fileTree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-2">
        <h2 className="text-base font-semibold text-zinc-300">{t("fileTree")}</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="space-y-1 px-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-zinc-800" />
            ))}
          </div>
        ) : error ? (
          <p className="px-4 text-sm text-red-400">{error}</p>
        ) : tree.length === 0 ? (
          <p className="px-4 text-sm text-zinc-600">{t("noFiles")}</p>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))
        )}
      </div>
    </div>
  );
}
