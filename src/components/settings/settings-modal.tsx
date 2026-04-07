"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTranslations } from "next-intl";

type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "ollama"
  | "azure";
type Locale = "zh-TW" | "en";
type Theme = "light" | "dark" | "system";
type TabId = "github" | "model" | "analysis" | "ui" | "about";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama (本地)" },
  { value: "azure", label: "Azure OpenAI" },
];

interface SettingsData {
  llmProvider: Provider;
  llmBaseUrl: string | null;
  llmModel: string;
  llmApiKey: string | null;
  githubToken: string | null;
  uiLocale: Locale;
  uiTheme: Theme | null;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");
  const [activeTab, setActiveTab] = useState<TabId>("github");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [githubToken, setGithubToken] = useState("");
  const [githubTokenChanged, setGithubTokenChanged] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [maxSteps, setMaxSteps] = useState(25);
  const [locale, setLocale] = useState<Locale>("zh-TW");
  const [theme, setTheme] = useState<Theme>("system");

  const TABS: { id: TabId; label: string }[] = [
    { id: "github", label: t("tabGithub") },
    { id: "model", label: t("tabModel") },
    { id: "analysis", label: t("tabAnalysis") },
    { id: "ui", label: t("tabInterface") },
    { id: "about", label: t("tabAbout") },
  ];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setProvider(data.llmProvider ?? "openai");
        setBaseUrl(data.llmBaseUrl ?? "");
        setModel(data.llmModel ?? "");
        setApiKey(data.llmApiKey === "***" ? "" : (data.llmApiKey ?? ""));
        setApiKeyChanged(false);
        setGithubToken(data.githubToken === "***" ? "" : (data.githubToken ?? ""));
        setGithubTokenChanged(false);
        setLocale(data.uiLocale ?? "zh-TW");
        setTheme(data.uiTheme ?? "system");
      })
      .catch(() => setError(t("loadFailed")))
      .finally(() => setLoading(false));
  }, [open, t]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llmProvider: provider,
          llmBaseUrl: baseUrl || null,
          llmModel: model,
          llmApiKey: apiKeyChanged ? (apiKey || null) : "***",
          githubToken: githubTokenChanged ? (githubToken || null) : "***",
          uiLocale: locale,
          uiTheme: theme,
        }),
      });
      if (res.ok) {
        setSuccess(t("saveSuccess"));
      } else {
        const d = await res.json() as { error?: string };
        setError(d.error ?? t("saveFailed"));
      }
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, baseUrl: baseUrl || undefined, model, apiKey }),
      });
      if (res.ok) {
        setTestResult(t("testSuccess"));
      } else {
        const d = await res.json() as { error?: string };
        setTestResult(`${t("testFailed")}: ${d.error ?? "未知錯誤"}`);
      }
    } catch {
      setTestResult(t("testFailed"));
    } finally {
      setTestingConnection(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : (
          <div className="flex gap-4">
            {/* Sidebar tabs */}
            <div className="flex w-28 flex-col gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 space-y-4">
              {activeTab === "github" && (
                <>
                  <h3 className="font-semibold">{t("githubSection")}</h3>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("githubTokenLabel")}</label>
                    <Input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => { setGithubToken(e.target.value); setGithubTokenChanged(true); }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("githubTokenHint")}
                    </p>
                  </div>
                </>
              )}

              {activeTab === "model" && (
                <>
                  <h3 className="font-semibold">{t("modelSection")}</h3>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as Provider)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("baseUrl")}</label>
                    <Input
                      placeholder="https://api.openai.com/v1"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("model")}</label>
                    <Input
                      placeholder="gpt-4o-mini"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("apiKey")}</label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setApiKeyChanged(true); }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                  >
                    {testingConnection ? t("testing") : t("testConnection")}
                  </Button>
                  {testResult && (
                    <p className={`text-sm ${testResult.includes(t("testSuccess")) ? "text-green-600" : "text-destructive"}`}>
                      {testResult}
                    </p>
                  )}
                </>
              )}

              {activeTab === "analysis" && (
                <>
                  <h3 className="font-semibold">{t("analysisSection")}</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("maxSteps")}：{maxSteps}
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5</span>
                      <span>50</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "ui" && (
                <>
                  <h3 className="font-semibold">{t("interfaceSection")}</h3>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("language")}</label>
                    <div className="flex gap-2">
                      {(["zh-TW", "en"] as Locale[]).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLocale(l)}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            locale === l
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {l === "zh-TW" ? "繁體中文" : "English"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("theme")}</label>
                    <div className="flex gap-2">
                      {(["light", "dark", "system"] as Theme[]).map((th) => (
                        <button
                          key={th}
                          onClick={() => setTheme(th)}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            theme === th
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {th === "light" ? t("themeLight") : th === "dark" ? t("themeDark") : t("themeSystem")}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "about" && (
                <>
                  <h3 className="font-semibold">{t("aboutSection")}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("version")}</span>
                      <span className="font-mono">0.1.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("project")}</span>
                      <span>RepoLens</span>
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              {activeTab !== "about" && (
                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? t("saving") : t("save")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
