"use client";

export const HARD_MIN = 100;
export const HARD_MAX = 15_000_000;

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