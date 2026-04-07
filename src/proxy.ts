import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual, hkdfSync } from "crypto";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth", "/api/setup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = request.cookies.get("repolens_session")?.value;
  if (!token) {
    return redirectOrUnauthorized(request, pathname);
  }

  // Verify token signature (HMAC) — no DB access in middleware
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) {
    return redirectOrUnauthorized(request, pathname);
  }

  const sessionId = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) return redirectOrUnauthorized(request, pathname);

  const derivedKey = Buffer.from(
    hkdfSync("sha256", Buffer.from(masterKey, "hex"), "", "repolens-session-signing", 32),
  );
  const hmac = createHmac("sha256", derivedKey);
  hmac.update(sessionId);
  const expected = hmac.digest("base64url");

  const sigBuf = Buffer.from(signature, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return redirectOrUnauthorized(request, pathname);
  }

  return NextResponse.next();
}

function redirectOrUnauthorized(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
