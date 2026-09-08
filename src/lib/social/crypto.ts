/**
 * At-rest encryption for social access/refresh tokens.
 *
 * Tokens are encrypted with AES-256-GCM and persisted as `iv.tag.ciphertext`,
 * all hex-encoded. The encryption key comes exclusively from the
 * SOCIAL_TOKEN_ENCRYPTION_KEY environment variable — the app refuses to
 * encrypt/decrypt without it (fail-closed), because an unencrypted fallback
 * would silently store tokens in plaintext.
 *
 * Decrypted tokens are only ever held in a single server request's memory and
 * are never written to logs or returned to the client.
 */

import crypto from "crypto";

export type EncryptedTokenPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function keyMaterial(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? "";
  if (!raw) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY is not set. It is required to securely store " +
        "social media access tokens in the database.",
    );
  }
  // Accept a raw 32-byte key or any passphrase we derive into a 32-byte key.
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt a plaintext token. Returns `${iv}.${tag}.${ciphertext}` (hex). */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = keyMaterial();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
}

/** Decrypt a token string produced by `encryptToken`. Returns null on failure. */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [ivHex, tagHex, dataHex] = stored.split(".");
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null; // bad tag = tampered or wrong key; never throws to caller
  }
}

/** Mask a token for display/verification purposes (never the whole secret). */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

/** Produce a short random nonce (for OAuth state etc.). */
export function randomState(): string {
  return crypto.randomBytes(24).toString("base64url");
}