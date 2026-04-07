import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";
import { getSettings } from "~/server/db/queries";
import { decryptIfNeeded } from "~/lib/crypto";

interface TestConnectionBody {
  provider: "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
  baseUrl?: string;
  model: string;
  apiKey?: string;
}

// Ensure baseURL ends with /v1 for OpenAI-compatible providers
// Must match the logic in src/server/agent/llm-factory.ts
function ensureV1(url: string | undefined, defaultUrl: string): string {
  const u = url || defaultUrl;
  const cleaned = u.replace(/\/+$/, "");
  return cleaned.endsWith("/v1") ? cleaned : `${cleaned}/v1`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TestConnectionBody;
    const { provider, baseUrl, model } = body;

    // If apiKey is empty, fall back to the stored key in DB
    let apiKey = body.apiKey ?? "";
    if (!apiKey) {
      const settings = await getSettings();
      if (settings?.llmApiKey) {
        apiKey = decryptIfNeeded(settings.llmApiKey) ?? "";
      }
    }

    if (!provider || !model) {
      return NextResponse.json(
        { error: "provider and model are required" },
        { status: 400 },
      );
    }

    let languageModel;
    switch (provider) {
      case "openai":
        languageModel = createOpenAI({
          apiKey,
          baseURL: baseUrl ? ensureV1(baseUrl, "") : undefined,
        })(model);
        break;
      case "anthropic":
        languageModel = createAnthropic({ apiKey, baseURL: baseUrl })(model);
        break;
      case "google":
        languageModel = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(model);
        break;
      case "azure":
        languageModel = createAzure({ apiKey })(model);
        break;
      case "openrouter":
        languageModel = createOpenAI({
          apiKey,
          baseURL: ensureV1(baseUrl, "https://openrouter.ai/api"),
        })(model);
        break;
      case "ollama":
        languageModel = createOpenAI({
          apiKey: "ollama",
          baseURL: ensureV1(baseUrl, "http://localhost:11434"),
        })(model);
        break;
      default:
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const result = await generateText({
      model: languageModel,
      prompt: "Reply with just the word: OK",
      maxOutputTokens: 10,
    });

    return NextResponse.json({ success: true, response: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
