/**
 * Minimal, dependency-free TOTP (RFC 6238) for the admin's two-step
 * verification. Uses only Node's built-in `crypto` module so no external
 * libraries are required.
 *
 * Secrets are random 160-bit base32 strings (like standard authenticator apps)
 * and codes are verified with an ±1 step tolerance to allow for clock skew.
 */

import crypto from "crypto";

/** Generate a random base32 TOTP secret (e.g. for QR provisioning). */
export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  return base32Encode(buf).replace(/=+$/, "");
}

/** Build an otpauth:// provisioning URI for authenticator apps. */
export function totpProvisioningUri(secret: string, email: string, issuer = "CelebrityPass Admin"): string {
  const label = encodeURIComponent(`CelebrityPass:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  }).toString();
  return `otpauth://totp/${label}?${params}`;
}

/** Compute the current/expected 6-digit code for `secret` at `time`. */
export function totpCode(secret: string, time = Date.now(), step = 30, digits = 6): string {
  const key = base32Decode(secret);
  const counter = Math.floor(time / 1000 / step);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  const mod = bin % 10 ** digits;
  return mod.toString().padStart(digits, "0");
}

/** Verify a user-supplied code against the secret, allowing ±1 step skew. */
export function verifyTotp(secret: string, input: string, now = Date.now()): boolean {
  if (!secret || !input) return false;
  const normalized = input.trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  const tolerance = 30 * 1000;
  for (const offset of [0, -tolerance, tolerance]) {
    const expected = totpCode(secret, now + offset);
    const a = Buffer.from(expected);
    const b = Buffer.from(normalized);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Node-compatible constant-time comparison helper. */
export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- base32 (RFC 4648, no padding required) helpers -------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}