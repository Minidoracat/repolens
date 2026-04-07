import { NextResponse } from "next/server";
import { listRemoteBranches } from "~/server/sources/github";
import { getSettings } from "~/server/db/queries";
import { decryptIfNeeded } from "~/lib/crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const settings = await getSettings();
    const token = settings?.githubToken
      ? decryptIfNeeded(settings.githubToken)
      : null;

    const result = await listRemoteBranches(url, token);
    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    const message = raw.replace(/https:\/\/[^@]+@/g, "https://***@");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
