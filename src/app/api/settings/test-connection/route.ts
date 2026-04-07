import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";

interface TestConnectionBody {
  provider: "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "azure";
  baseUrl?: string;
  model: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TestConnectionBody;
    const { provider, baseUrl, model, apiKey = "" } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { error: "provider and model are required" },
        { status: 400 },
      );
    }

    let languageModel;
    switch (provider) {
      case "openai":
        languageModel = createOpenAI({ apiKey, baseURL: baseUrl })(model);
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
          baseURL: baseUrl ?? "https://openrouter.ai/api/v1",
        })(model);
        break;
      case "ollama":
        languageModel = createOpenAI({
          apiKey: "ollama",
          baseURL: baseUrl ?? "http://localhost:11434/v1",
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
