import { NextResponse } from "next/server";
import { getSettings, upsertSettings } from "~/server/db/queries";
import { encryptIfNeeded } from "~/lib/crypto";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function GET() {
  try {
    const s = await getSettings();
    if (!s) {
      return NextResponse.json({ error: "Not initialized" }, { status: 404 });
    }

    return NextResponse.json({
      llmProvider: s.llmProvider,
      llmBaseUrl: s.llmBaseUrl,
      llmModel: s.llmModel,
      llmApiKey: s.llmApiKey ? "***" : null,
      githubToken: s.githubToken ? "***" : null,
      uiLocale: s.uiLocale,
      uiTheme: s.uiTheme,
      isInitialized: s.isInitialized,
    });
  } catch (err) {
    log.error({ err }, "Failed to get settings");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface SettingsPatch {
  llmProvider?: "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
  llmBaseUrl?: string | null;
  llmModel?: string;
  llmApiKey?: string | null;
  githubToken?: string | null;
  uiLocale?: "zh-TW" | "en";
  uiTheme?: "light" | "dark" | "system";
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as SettingsPatch;

    const patch: Record<string, unknown> = {};

    if (body.llmProvider !== undefined) patch.llmProvider = body.llmProvider;
    if (body.llmBaseUrl !== undefined) patch.llmBaseUrl = body.llmBaseUrl;
    if (body.llmModel !== undefined) patch.llmModel = body.llmModel;
    if (body.uiLocale !== undefined) patch.uiLocale = body.uiLocale;
    if (body.uiTheme !== undefined) patch.uiTheme = body.uiTheme;

    // Encrypt sensitive fields if provided and not masked
    if (body.llmApiKey !== undefined) {
      patch.llmApiKey =
        body.llmApiKey === null || body.llmApiKey === "***"
          ? undefined
          : encryptIfNeeded(body.llmApiKey);
      if (body.llmApiKey === null) patch.llmApiKey = null;
    }
    if (body.githubToken !== undefined) {
      patch.githubToken =
        body.githubToken === null || body.githubToken === "***"
          ? undefined
          : encryptIfNeeded(body.githubToken);
      if (body.githubToken === null) patch.githubToken = null;
    }

    await upsertSettings(patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, "Failed to update settings");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
