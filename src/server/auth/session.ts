import { randomBytes, createHmac, timingSafeEqual, hkdfSync } from "crypto";
import { cookies } from "next/headers";
import { createSession, getSession, deleteSession } from "../db/queries";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "repolens_session";
const MAX_AGE = parseInt(process.env.SESSION_MAX_AGE_SECONDS || "2592000", 10); // 30 days

function getSessionSecret(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) throw new Error("ENCRYPTION_KEY is required for session signing");
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(masterKey, "hex"), "", "repolens-session-signing", 32),
  );
}

function signToken(sessionId: string): string {
  const hmac = createHmac("sha256", getSessionSecret());
  hmac.update(sessionId);
  const signature = hmac.digest("base64url");
  return `${sessionId}.${signature}`;
}

function verifyToken(token: string): string | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const sessionId = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const hmac = createHmac("sha256", getSessionSecret());
  hmac.update(sessionId);
  const expectedSignature = hmac.digest("base64url");

  const sigBuf = Buffer.from(signature, "base64url");
  const expBuf = Buffer.from(expectedSignature, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  return sessionId;
}

export async function createUserSession(): Promise<string> {
  const sessionId = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);

  await createSession(sessionId, expiresAt);

  const token = signToken(sessionId);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return token;
}

export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const sessionId = verifyToken(token);
  if (!sessionId) return false;

  const session = await getSession(sessionId);
  return session !== null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const sessionId = verifyToken(token);
    if (sessionId) {
      await deleteSession(sessionId);
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
