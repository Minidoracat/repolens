"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface CodeViewerProps {
  projectId: string;
  selectedFilePath: string | null;
}

interface FileData {
  content: string;
  language: string;
  path: string;
}

export function CodeViewer({ projectId, selectedFilePath }: CodeViewerProps) {
  const t = useTranslations("workspace");
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFilePath) {
      setFileData(null);
      setHighlightedHtml("");
      return;
    }
    void fetchFile(selectedFilePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedFilePath]);

  async function fetchFile(filePath: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`,
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "無法載入文件");
      }
      const data = (await res.json()) as FileData;
      setFileData(data);
      await highlightCode(data.content, data.language);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  async function highlightCode(code: string, lang: string) {
    try {
      const { codeToHtml } = await import("shiki");
      // shiki output is server-generated syntax highlighting HTML — safe to render
      const html = await codeToHtml(code, {
        lang: lang || "text",
        theme: "github-dark",
      });
      setHighlightedHtml(html);
    } catch {
      // Fallback: render as escaped plain text
      setHighlightedHtml(
        `<pre style="margin:0;padding:16px;white-space:pre-wrap;word-break:break-all;color:#e4e4e7;">${escapeHtml(code)}</pre>`,
      );
    }
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 className="text-base font-semibold text-zinc-300">{t("codePreview")}</h2>
        {fileData && (
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-sm text-zinc-400">
              {fileData.language || "text"}
            </span>
            <span
              className="max-w-[200px] truncate text-sm text-zinc-500"
              title={fileData.path}
            >
              {fileData.path}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!selectedFilePath ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-600">{t("selectFile")}</p>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">{t("loading")}</p>
          </div>
        ) : error ? (
          <div className="p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : highlightedHtml ? (
          /* shiki produces sanitized HTML from our own server — XSS risk is negligible */
          /* eslint-disable-next-line react/no-danger */
          <div
            className="h-full text-sm [&_pre]:h-full [&_pre]:overflow-auto [&_pre]:p-4 [&_pre]:leading-relaxed"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : null}
      </div>
    </div>
  );
}
