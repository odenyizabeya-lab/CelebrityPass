"use client";

export const HARD_MIN = 100;
export const HARD_MAX = 15_000_000;

export const QUICK_AMOUNTS = [100, 500, 1_000, 5_000, 10_000, 25_000];

/** "$1,234.56" — fixed 2 decimals, thousands grouping. */
export function formatUSD(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Live-converts whatever a user is typing into a clean USD string like
 * "1,000" / "1,000.50" (grouped integer part, at most 2 decimals). Keeps the
 * raw input intact so it can be parsed back without loss.
 */
export function formatUSDInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const intPart = (parts[0] || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (parts.length > 1) {
    const dec = parts.slice(1).join("").slice(0, 2);
    return dec ? `${intPart}.${dec}` : `${intPart}`;
  }
  return intPart || "0";
}

/** Parses a possibly-formatted amount string back to a number (0 if invalid). */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned.trim() !== "" ? n : 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type BankAccount = {
  id: string;
  currency: string;
  countryName: string;
  beneficiary: string;
  bankName: string;
  accountType: string | null;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  routing: string | null;
  sortCode: string | null;
  bankCode: string | null;
  transferType: string | null;
};

export type DepositIntent = {
  pendingTxnId: string;
  depositRef: string;
  amount: string;
  bankAccount: BankAccount | null;
  atmInstructions: string | null;
  method: "bank-transfer" | "atm-deposit";
};

export function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function postDepositIntent(amount: string, method: "bank-transfer" | "atm-deposit") {
  const res = await fetch("/api/invest/deposits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, method }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not start your deposit. Please try again.");
  if (!data.pendingTxnId || !data.depositRef) throw new Error("The payment could not be started. Please try again.");
  return data as DepositIntent;
}

export async function postDepositProof(input: {
  txnId: string;
  method: "bank-transfer" | "atm-deposit";
  amountCents: number;
  currency?: string;
  senderName?: string;
  reference?: string;
  transferDate?: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
}) {
  const res = await fetch(`/api/invest/deposits/${input.txnId}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amountCents: input.amountCents,
      currency: input.currency ?? "USD",
      method: input.method,
      senderName: input.senderName ?? "",
      reference: input.reference ?? "",
      transferDate: input.transferDate ?? null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileUrl: input.fileUrl,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "We could not submit your receipt. Please try again.");
  return data;
}