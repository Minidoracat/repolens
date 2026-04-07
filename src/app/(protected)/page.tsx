"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTranslations } from "next-intl";

type SourceTab = "github" | "local" | "zip";

interface Project {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  createdAt: string;
  updatedAt: string;
  latestRunId: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("home");
  const [activeTab, setActiveTab] = useState<SourceTab>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = (await res.json()) as { projects: Project[] };
        setProjects(data.projects);
      }
    } catch {
      // ignore
    } finally {
      setProjectsLoading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      let res: Response;
      if (activeTab === "github") {
        if (!githubUrl.trim()) throw new Error(t("errorGithubUrl"));
        res = await fetch("/api/projects/from-github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: githubUrl.trim() }),
        });
      } else if (activeTab === "local") {
        if (!localPath.trim()) throw new Error(t("errorLocalPath"));
        res = await fetch("/api/projects/from-local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: localPath.trim() }),
        });
      } else {
        if (!zipFile) throw new Error(t("errorZipFile"));
        const formData = new FormData();
        formData.append("file", zipFile);
        res = await fetch("/api/projects/from-zip", {
          method: "POST",
          body: formData,
        });
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? t("errorSubmit"));
      }

      const data = (await res.json()) as { projectId: string };
      router.push(`/workspace/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorUnknown"));
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".zip")) {
      setZipFile(file);
    } else {
      setError(t("errorZipOnly"));
    }
  }

  const tabs: { key: SourceTab; label: string }[] = [
    { key: "github", label: t("tabGithub") },
    { key: "local", label: t("tabLocal") },
    { key: "zip", label: t("tabZip") },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-5xl font-bold text-orange-500">{t("title")}</h1>
        <p className="text-xl text-zinc-400">{t("subtitle")}</p>
      </div>

      {/* Input card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-zinc-950 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(null); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-4">
          {activeTab === "github" && (
            <div className="space-y-3">
              <label className="text-sm text-zinc-400">{t("githubLabel")}</label>
              <Input
                placeholder={t("githubPlaceholder")}
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder-zinc-600"
              />
            </div>
          )}

          {activeTab === "local" && (
            <div className="space-y-3">
              <label className="text-sm text-zinc-400">{t("localLabel")}</label>
              <Input
                placeholder={t("localPlaceholder")}
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder-zinc-600"
              />
            </div>
          )}

          {activeTab === "zip" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                isDragging
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
              />
              {zipFile ? (
                <p className="text-zinc-300">{zipFile.name}</p>
              ) : (
                <>
                  <p className="text-zinc-400">{t("uploadDrop")}</p>
                  <p className="mt-1 text-sm text-zinc-600">{t("uploadDropSub")}</p>
                </>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-900/30 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="w-full bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? t("analyzing") : t("analyzeButton")}
          </Button>
        </div>
      </div>

      {/* Projects history */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">{t("history")}</h2>
        {projectsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-800" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-zinc-600">{t("noHistory")}</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/workspace/${project.id}`)}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-600"
              >
                <div>
                  <p className="font-medium text-zinc-100">{project.name}</p>
                  <p className="text-xs text-zinc-500">
                    {project.sourceType === "github_public" || project.sourceType === "github_private"
                      ? t("sourceGithub")
                      : project.sourceType === "local_path"
                      ? t("sourceLocal")
                      : t("sourceZip")}{" "}
                    · {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-zinc-500">→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
