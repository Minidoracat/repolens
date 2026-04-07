import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { upsertSettings, getSettings } from "~/server/db/queries";
import { createUserSession } from "~/server/auth/session";
import { encryptIfNeeded } from "~/lib/crypto";

interface InitializeBody {
  password: string;
  llmProvider: "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
  llmBaseUrl?: string;
  llmModel: string;
  llmApiKey?: string;
  githubToken?: string;
  uiLocale?: "zh-TW" | "en";
}

export async function POST(request: Request) {
  try {
    const existingSettings = await getSettings();
    if (existingSettings?.isInitialized) {
      return NextResponse.json({ error: "Already initialized" }, { status: 403 });
    }

    const body = await request.json() as InitializeBody;
    const {
      password,
      llmProvider,
      llmBaseUrl,
      llmModel,
      llmApiKey,
      githubToken,
      uiLocale = "zh-TW",
    } = body;

    if (!password || !llmProvider || !llmModel) {
      return NextResponse.json(
        { error: "password, llmProvider and llmModel are required" },
        { status: 400 },
      );
    }

    const adminPasswordHash = await bcrypt.hash(password, 12);
    const encryptedApiKey = llmApiKey ? encryptIfNeeded(llmApiKey) : null;
    const encryptedGithubToken = githubToken ? encryptIfNeeded(githubToken) : null;

    await upsertSettings({
      adminPasswordHash,
      llmProvider,
      llmBaseUrl: llmBaseUrl ?? null,
      llmModel,
      llmApiKey: encryptedApiKey,
      githubToken: encryptedGithubToken,
      uiLocale,
      isInitialized: true,
    });

    await createUserSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Setup initialize error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
