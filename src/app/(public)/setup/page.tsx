"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTranslations } from "next-intl";

type Provider = "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
type Locale = "zh-TW" | "en";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama (本地)" },
  { value: "azure", label: "Azure OpenAI" },
];

export default function SetupPage() {
  const router = useRouter();
  const t = useTranslations("setup");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 — 密碼
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Step 2 — LLM
  const [provider, setProvider] = useState<Provider>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  // Step 3 — GitHub
  const [githubToken, setGithubToken] = useState("");

  // Step 4 — 語言
  const [locale, setLocale] = useState<Locale>("zh-TW");

  function nextStep() {
    setError("");
    if (step === 1) {
      if (!password || password.length < 8) {
        setError(t("passwordTooShort"));
        return;
      }
      if (password !== passwordConfirm) {
        setError(t("passwordMismatch"));
        return;
      }
    }
    if (step === 2) {
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
        const data = await res.json() as { error?: string };
        setError(data.error ?? t("initFailed"));
      }
    } catch {
      setError(t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t("titleFull")}</h1>
        <p className="text-sm text-muted-foreground">{t("step")} {step} {t("of")} 4</p>
        <div className="flex gap-1 pt-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step1Title")}</h2>
          <Input
            type="password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <Input
            type="password"
            placeholder={t("confirmPasswordPlaceholder")}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step2Title")}</h2>
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

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step3Title")}</h2>
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

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold">{t("step4Title")}</h2>
          <div className="flex gap-3">
            {(["zh-TW", "en"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
            className="flex-1"
          >
            {t("previous")}
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={nextStep} className="flex-1">
            {t("next")}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? t("completing") : t("complete")}
          </Button>
        )}
      </div>
    </div>
  );
}
