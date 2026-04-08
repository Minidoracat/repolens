import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { createModuleLogger } from "~/server/logger";

const log = createModuleLogger("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -hex 32",
    );
  }
  if (keyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${keyHex.length} characters.`,
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a random IV.
 * Output format: base64(iv):base64(ciphertext):base64(authTag)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted}:${authTag.toString("base64")}`;
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format. Expected iv:ciphertext:authTag");
  }

  const iv = Buffer.from(parts[0]!, "base64");
  const encrypted = parts[1]!;
  const authTag = Buffer.from(parts[2]!, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypts a value only if it's not already encrypted (idempotent).
 * Returns null for null/undefined input.
 */
export function encryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null;
  // Already encrypted values have the iv:ciphertext:authTag format
  if (value.split(":").length === 3) {
    try {
      decrypt(value); // verify it's actually encrypted with our key
      return value;
    } catch {
      // Not encrypted with our key, encrypt it
    }
  }
  return encrypt(value);
}

/**
 * Decrypts a value, returning null for null/undefined input.
 */
export function decryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch (err) {
    log.warn({ err }, "Failed to decrypt value — possible ENCRYPTION_KEY mismatch");
    return null; // Return null instead of raw ciphertext
  }
}
