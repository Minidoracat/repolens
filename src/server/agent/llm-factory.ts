import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { getSettings } from "../db/queries";
import { decryptIfNeeded } from "../../lib/crypto";

export async function getLanguageModel() {
  const s = await getSettings();
  if (!s) throw new Error("Settings not initialized");

  const apiKey = decryptIfNeeded(s.llmApiKey) ?? "";
  const baseURL = s.llmBaseUrl ?? undefined;
  const model = s.llmModel;

  // Ensure baseURL ends with /v1 for OpenAI-compatible providers
  function ensureV1(url: string | undefined, defaultUrl: string): string {
    const u = url || defaultUrl;
    const cleaned = u.replace(/\/+$/, "");
    return cleaned.endsWith("/v1") ? cleaned : `${cleaned}/v1`;
  }

  switch (s.llmProvider) {
    case "openai":
      return createOpenAI({
        apiKey,
        baseURL: baseURL ? ensureV1(baseURL, "") : undefined,
      }).chat(model);
    case "anthropic":
      return createAnthropic({ apiKey, baseURL })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey, baseURL })(model);
    case "azure":
      return createAzure({ apiKey })(model);
    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: ensureV1(baseURL, "https://openrouter.ai/api"),
      }).chat(model);
    case "ollama":
      return createOpenAI({
        apiKey: "ollama",
        baseURL: ensureV1(baseURL, "http://localhost:11434"),
      }).chat(model);
    default:
      throw new Error(`Unknown provider: ${String(s.llmProvider)}`);
  }
}
