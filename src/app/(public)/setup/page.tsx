"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type Provider = "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
type Locale = "zh-TW" | "en";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "azure", label: "Azure OpenAI" },
];

// i18n labels — step 1 must be bilingual since locale isn't chosen yet
const T: Record<Locale, Record<string, string>> = {
  "zh-TW": {
    title: "RepoLens 初始設定",
    step1Title: "選擇界面語言",
    step2Title: "設定管理員密碼",
    step3Title: "LLM 模型配置",
    step4Title: "GitHub Token（選填）",
    passwordPlaceholder: "密碼（至少 8 個字元）",
    confirmPasswordPlaceholder: "再次輸入密碼",
    passwordTooShort: "密碼至少需要 8 個字元",
    passwordMismatch: "兩次密碼不一致",
    modelRequired: "請填寫模型名稱",
    baseUrlPlaceholder: "Base URL（選填，如自架服務）",
    modelPlaceholder: "模型名稱（如 gpt-4o-mini）",
    apiKey: "API Key",
    githubTokenHint: "用於存取私有倉庫或提高 API 速率限制。可稍後在設定中配置。",
    githubTokenPlaceholder: "ghp_xxxxxxxxxxxx",
    next: "下一步",
    previous: "上一步",
    complete: "完成設定",
    completing: "初始化中...",
    initFailed: "初始化失敗",
    errorOccurred: "發生錯誤，請稍後再試",
    skip: "略過",
    step: "步驟",
    of: "/",
  },
  en: {
    title: "RepoLens Initial Setup",
    step1Title: "Choose Interface Language",
    step2Title: "Set Admin Password",
    step3Title: "Configure LLM Model",
    step4Title: "GitHub Token (Optional)",
    passwordPlaceholder: "Password (at least 8 characters)",
    confirmPasswordPlaceholder: "Re-enter password",
    passwordTooShort: "Password must be at least 8 characters",
    passwordMismatch: "Passwords do not match",
    modelRequired: "Please enter a model name",
    baseUrlPlaceholder: "Base URL (optional, e.g. self-hosted)",
    modelPlaceholder: "Model name (e.g. gpt-4o-mini)",
    apiKey: "API Key",
    githubTokenHint: "For accessing private repos or increasing API rate limits. Can be configured later in settings.",
    githubTokenPlaceholder: "ghp_xxxxxxxxxxxx",
    next: "Next",
    previous: "Previous",
    complete: "Complete Setup",
    completing: "Initializing...",
    initFailed: "Initialization failed",
    errorOccurred: "An error occurred, please try again",
    skip: "Skip",
    step: "Step",
    of: "/",
  },
};

const STEP_COUNT = 4;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect if already initialized
  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data: { isInitialized?: boolean }) => {
        if (data.isInitialized) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  // Step 1 — 語言
  const [locale, setLocale] = useState<Locale>("zh-TW");

  // Step 2 — 密碼
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Step 3 — LLM
  const [provider, setProvider] = useState<Provider>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  // Step 4 — GitHub
  const [githubToken, setGithubToken] = useState("");

  const t = useCallback((key: string) => T[locale][key] ?? key, [locale]);

  function nextStep() {
    setError("");
    if (step === 2) {
      if (!password || password.length < 8) {
        setError(t("passwordTooShort"));
        return;
      }
      if (password !== passwordConfirm) {
        setError(t("passwordMismatch"));
        return;
      }
    }
    if (step === 3) {
      if (!model) {
        setError(t("modelRequired"));
        return;
      }
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          llmProvider: provider,
          llmBaseUrl: baseUrl || undefined,
          llmModel: model,
          llmApiKey: apiKey || undefined,
          githubToken: githubToken || undefined,
          uiLocale: locale,
        }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t("initFailed"));
      }
    } catch {
      setError(t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("step")} {step} {t("of")} {STEP_COUNT}
        </p>
        <div className="flex gap-1 pt-1">
          {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Language — shown bilingually */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold">
            選擇界面語言 / Choose Language
          </h2>
          <div className="flex gap-3">
            {(["zh-TW", "en"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
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
      )}

      {/* Step 2: Password */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step2Title")}</h2>
          <Input
            type="password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          <Input
            type="password"
            placeholder={t("confirmPasswordPlaceholder")}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      )}

      {/* Step 3: LLM */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step3Title")}</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm cursor-pointer"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder={t("baseUrlPlaceholder")}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <Input
            placeholder={t("modelPlaceholder")}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("apiKey")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      )}

      {/* Step 4: GitHub Token */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step4Title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("githubTokenHint")}
          </p>
          <Input
            type="password"
            placeholder={t("githubTokenPlaceholder")}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={() => { setError(""); setStep((s) => s - 1); }}
            disabled={loading}
            className="flex-1 cursor-pointer"
          >
            {t("previous")}
          </Button>
        )}
        {step < STEP_COUNT ? (
          <Button onClick={nextStep} className="flex-1 cursor-pointer">
            {t("next")}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 cursor-pointer">
            {loading ? t("completing") : t("complete")}
          </Button>
        )}
      </div>
    </div>
  );
}
