"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? t("loginFailed"));
      }
    } catch {
      setError(t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">RepoLens</h1>
        <p className="text-sm text-muted-foreground">{t("enterAdminPassword")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("loggingIn") : t("loginButton")}
        </Button>
      </form>
    </div>
  );
}
