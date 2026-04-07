"use client";
import { useTransition } from "react";
import { useLocale } from "next-intl";

export function LocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: string) => {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
      window.location.reload();
    });
  };

  return (
    <button
      onClick={() => switchLocale(locale === "zh-TW" ? "en" : "zh-TW")}
      disabled={isPending}
      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
    >
      {locale === "zh-TW" ? "EN" : "中文"}
    </button>
  );
}
