// Client-side AES-256-GCM encryption for Flutterwave V4 card fields.
//
// Card numbers NEVER reach our servers. The browser encrypts each card field
// with the dashboard Encryption Key + a one-off 12-char nonce (exactly the
// algorithm in Flutterwave's V4 Encryption docs), and only the ciphertexts +
// that nonce are posted to the app.
//
// This module is imported ONLY by client components ("use client") — it uses the
// Web Crypto API (crypto.subtle), which is available in secure contexts only.
import type { FwEncryptedCard } from "./flutterwave";

const NONCE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const FW_NONCE_LENGTH = 12;

/** Generate a 12-char nonce (alphanumeric, per Flutterwave's examples). */
export function generateFlutterwaveNonce(): string {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random numbers are not available in this browser.");
  }
  const bytes = new Uint8Array(FW_NONCE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += NONCE_ALPHABET[bytes[i] % NONCE_ALPHABET.length];
  }
  return out;
}

/** AES-256-GCM encrypt `plain` with the base64 Encryption Key + `nonce` as IV. */
export async function encryptFlutterwaveField(plain: string, keyBase64: string, nonce: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== "object") {
    throw new Error("This browser does not support the secure crypto needed for card payments.");
  }
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new TextEncoder().encode(nonce);
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export type FwRawCard = {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
};

/** Encrypt a card (number / expiry / cvc) with one shared nonce. */
export async function encryptFlutterwaveCard(card: FwRawCard, keyBase64: string): Promise<FwEncryptedCard> {
  const nonce = generateFlutterwaveNonce();
  const [encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv] = await Promise.all([
    encryptFlutterwaveField(card.number, keyBase64, nonce),
    encryptFlutterwaveField(card.expiryMonth, keyBase64, nonce),
    encryptFlutterwaveField(card.expiryYear, keyBase64, nonce),
    encryptFlutterwaveField(card.cvc, keyBase64, nonce),
  ]);
  return { nonce, encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv };
}

/** Encrypt just the card PIN with its own fresh nonce (PIN auth step). */
export async function encryptFlutterwavePin(pin: string, keyBase64: string): Promise<{ nonce: string; encrypted_pin: string }> {
  const nonce = generateFlutterwaveNonce();
  const encrypted_pin = await encryptFlutterwaveField(pin, keyBase64, nonce);
  return { nonce, encrypted_pin };
}