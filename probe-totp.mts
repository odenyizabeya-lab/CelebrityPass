import crypto from "crypto";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHA.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret: string, time = Date.now()): string {
  const key = b32decode(secret);
  const counter = Math.floor(time / 1000 / 30);
  const cb = Buffer.alloc(8);
  cb.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(cb).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return (bin % 1000000).toString().padStart(6, "0");
}

const secret = process.argv[2];
console.log(JSON.stringify({ secret, code: totp(secret) }));