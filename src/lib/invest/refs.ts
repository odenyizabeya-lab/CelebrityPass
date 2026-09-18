import { prisma } from "@/lib/db";

/** Pad + prefix a sequence number into INV-000001 style investor numbers. */
export function investorNumberFromSeq(seq: number): string {
  return `INV-${String(seq).padStart(6, "0")}`;
}

/** Generate the next investor account sequence number. */
export async function nextInvestorSeq(): Promise<number> {
  const latest = await prisma.investorAccount.findFirst({
    orderBy: { investorNumber: "desc" },
    select: { investorNumber: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.investorNumber.replace("INV-", ""), 10);
  return isNaN(seq) ? 1 : seq + 1;
}

/** Transaction reference TXN-000001 style. */
export function txnRefFromSeq(seq: number): string {
  return `TXN-${String(seq).padStart(6, "0")}`;
}

export async function nextTxnSeq(): Promise<number> {
  const latest = await prisma.transaction.findFirst({
    orderBy: { txnRef: "desc" },
    select: { txnRef: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.txnRef.replace("TXN-", ""), 10);
  return isNaN(seq) ? 1 : seq + 1;
}

/** Withdrawal reference WDR-000001 style. */
export function wdrRefFromSeq(seq: number): string {
  return `WDR-${String(seq).padStart(6, "0")}`;
}

export async function nextWdrSeq(): Promise<number> {
  const latest = await prisma.withdrawal.findFirst({
    orderBy: { ref: "desc" },
    select: { ref: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.ref.replace("WDR-", ""), 10);
  return isNaN(seq) ? 1 : seq + 1;
}

/** Adjustment reference ADJ-000001 style. */
export function adjRefFromSeq(seq: number): string {
  return `ADJ-${String(seq).padStart(6, "0")}`;
}

export async function nextAdjSeq(): Promise<number> {
  const latest = await prisma.adjustment.findFirst({
    orderBy: { ref: "desc" },
    select: { ref: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.ref.replace("ADJ-", ""), 10);
  return isNaN(seq) ? 1 : seq + 1;
}