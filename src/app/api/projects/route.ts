import { NextResponse } from "next/server";
import { listProjects } from "~/server/db/queries";
import { createModuleLogger } from "~/server/logger";
const log = createModuleLogger("api");

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    log.error({ err }, "Failed to list projects");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
