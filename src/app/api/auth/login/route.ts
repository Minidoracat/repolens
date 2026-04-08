import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getSettings } from "~/server/db/queries";
import { createUserSession } from "~/server/auth/session";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: string };
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const settings = await getSettings();

    if (!settings?.adminPasswordHash || !settings.isInitialized) {
      return NextResponse.json({ error: "Not initialized" }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, settings.adminPasswordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await createUserSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, "Login failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
