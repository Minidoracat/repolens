import { NextResponse } from "next/server";
import { getSettings } from "~/server/db/queries";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      isInitialized: settings?.isInitialized ?? false,
    });
  } catch (err) {
    console.error("[RepoLens]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
