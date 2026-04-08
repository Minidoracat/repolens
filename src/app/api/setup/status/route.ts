import { NextResponse } from "next/server";
import { getSettings } from "~/server/db/queries";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      isInitialized: settings?.isInitialized ?? false,
    });
  } catch (err) {
    log.error({ err }, "Failed to get setup status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
