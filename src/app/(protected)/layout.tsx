"use client";

import { useState } from "react";
import Link from "next/link";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { SettingsModal } from "~/components/settings/settings-modal";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-500">RepoLens</span>
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title="設定"
          >
            ⚙️
          </button>
        </div>
      </header>
      <main className="flex-grow">
        {children}
      </main>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
