/**
 * Universal Bank Transfer proof flow.
 *
 * A customer picks "Bank Transfer", sends real money to the admin-managed bank
 * account, then submits transfer details + a proof image. That creates a
 * BankTransferProof that is ALWAYS PENDING_VERIFICATION — never auto-paid. An
 * admin reviews the actual receipt in the admin queue and, only after
 * confirming real receipt, APPROVES it (which settles the purchase) or
 * REJECTS it.
 *
 * Works identically for fans-card Payments and ticket orders.
 */

import { prisma } from "@/lib/db";
import { getActiveBankAccountForCurrency, serializeProof, type BankTransferProofPayload } from "./banking";
import { getOrderForHolder } from "./service";
import { settlePayment } from "@/lib/payments";
import { getCurrentFanId } from "@/lib/auth";
import { pushStatusHistory } from "./helpers";

export type ProofInput = {
  senderName?: string | null;
  reference?: string | null;
  transferDate?: string | null; // ISO date
  amountCents: number;
  currency: string;
  fileName?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
};

/**
 * Resolve the FINAL PENDING_VERIFICATION status set on a row given a desired
 * paymentStatus value. We always use the dedicated proof status.
 */
export const PROOF_OK = "PENDING_VERIFICATION";

/**
 * Validate the customer-submitted proof shape. Server-side only — the admin
 * still verifies the actual receipt before settlement, but this prevents
 * malformed/DoS payloads (huge base64 blobs, non-images, invalid amounts).
 */
function validateProof(p: ProofInput): string | null {
  if (!Number.isFinite(p.amountCents) || p.amountCents <= 0) {
    return "Please enter a valid transfer amount.";
  }
  if (p.fileUrl && (typeof p.fileUrl !== "string" || p.fileUrl.length > 2_500_000)) {
    return "Uploaded proof is too large.";
  }
  if (p.fileUrl && !p.fileUrl.startsWith("data:image/")) {
    return "The proof must be an image upload.";
  }
  if (p.mimeType && !/^image\//.test(p.mimeType)) {
    return "The proof must be an image upload.";
  }
  return null;
}

/**
 * Submit a bank-transfer proof for ONE kind of purchase. Caller passes the
 * owning fan (for fan cards) or the orderRef+token (for tickets). The purchase
 * is only ever settled via admin verification afterwards.
 */
export async function submitBankTransferProof(args: {
  kind: "FAN_CARD" | "TICKET";
  fanCardPaymentId?: string; // for FAN_CARD
  ticketOrderRef?: string; // for TICKET
  token?: string | null; // required for TICKET ownership
  proof: ProofInput;
}): Promise<{ ok: true; proof: BankTransferProofPayload; status: string } | { ok: false; status: number; event: string; message: string }> {
  // Resolve the purchase + ownership.
  let paymentId: string | null = null;
  let orderId: string | null = null;
  let currency: string;

  if (args.kind === "FAN_CARD") {
    if (!args.fanCardPaymentId) return { ok: false, status: 400, event: "MISSING_PAYMENT", message: "Missing payment." };
    const fanId = await getCurrentFanId();
    const payment = await prisma.payment.findUnique({ where: { id: args.fanCardPaymentId } });
    if (!payment) return { ok: false, status: 404, event: "PAYMENT_NOT_FOUND", message: "Payment not found." };
    if (!fanId || payment.fanId !== fanId) {
      return { ok: false, status: 401, event: "UNAUTHORIZED", message: "Please sign in to add payment proof." };
    }
    if (payment.status === "PAID" && payment.cardId) {
      return { ok: false, status: 409, event: "ALREADY_PAID", message: "This payment is already complete." };
    }
    paymentId = payment.id;
    currency = payment.currency || "USD";
  } else {
    if (!args.ticketOrderRef) return { ok: false, status: 400, event: "MISSING_ORDER", message: "Missing order reference." };
    const order = await getOrderForHolder(args.ticketOrderRef, args.token ?? null);
    if (!order) return { ok: false, status: 404, event: "ORDER_NOT_FOUND", message: "Order not found." };
    if (order.status === "CONFIRMED") return { ok: false, status: 409, event: "ALREADY_PAID", message: "This order is already paid." };
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { ok: false, status: 409, event: "ORDER_CLOSED", message: `This order is ${order.status.toLowerCase()}.` };
    }
    orderId = order.id;
    currency = order.currency || "USD";
  }

  const bankAccount = await getActiveBankAccountForCurrency(currency);
  if (!bankAccount) {
    return { ok: false, status: 409, event: "BANK_NOT_CONFIGURED", message: `Bank Transfer isn't available for ${currency}.` };
  }

  const proofError = validateProof(args.proof);
  if (proofError) return { ok: false, status: 400, event: "INVALID_PROOF", message: proofError };

  const proof = await prisma.bankTransferProof.create({
    data: {
      bankAccountId: bankAccount.id,
      amountCents: args.proof.amountCents,
      currency,
      senderName: args.proof.senderName?.trim() || null,
      reference: args.proof.reference?.trim() || null,
      transferDate: args.proof.transferDate ? new Date(args.proof.transferDate) : null,
      fileName: args.proof.fileName || null,
      fileUrl: args.proof.fileUrl || null,
      mimeType: args.proof.mimeType || null,
      status: "PENDING_VERIFICATION",
      paymentId,
      ticketOrderId: orderId,
    },
    include: { bankAccount: { select: { currency: true, countryName: true } } },
  });

  // Keep the purchase in a clearly-not-paid state with an honest note.
  if (paymentId) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PENDING", provider: "bank-transfer" },
    });
  } else if (orderId) {
    const order = await prisma.ticketOrder.findUnique({ where: { id: orderId } });
    await prisma.ticketOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: "UNPAID",
        status: "PENDING_PAYMENT",
        paymentMethodId: null,
        statusHistoryJson: pushStatusHistory(order?.statusHistoryJson ?? null, {
          status: "PENDING_PAYMENT",
          at: new Date().toISOString(),
          note: "Bank Transfer proof submitted — awaiting admin verification.",
        }),
      },
    });
  }

  return { ok: true, proof: serializeProof(proof), status: "PENDING_VERIFICATION" };
}

// ===== Admin verification =====

export type VerifyResult =
  | { ok: true; settledKind: "FAN_CARD" | "TICKET" | null; status: string }
  | { ok: false; status: number; message: string };

/**
 * Admin marks a proof APPROVED (real receipt confirmed) or REJECTED.
 * APPROVED is the ONLY path that settles a purchase to paid/confirmed.
 */
export async function reviewBankTransferProof(args: {
  proofId: string;
  decision: "APPROVE" | "REJECT";
  adminNote?: string | null;
  origin?: string | null;
}): Promise<VerifyResult> {
  const proof = await prisma.bankTransferProof.findUnique({
    where: { id: args.proofId },
    include: { payment: true, ticketOrder: true, bankAccount: true },
  });
  if (!proof) return { ok: false, status: 404, message: "Proof not found." };
  if (proof.status !== "PENDING_VERIFICATION") {
    return { ok: false, status: 409, message: `This proof was already ${proof.status.toLowerCase()}.` };
  }

  const now = new Date();
  if (args.decision === "REJECT") {
    await prisma.bankTransferProof.update({
      where: { id: proof.id },
      data: { status: "REJECTED", adminNote: args.adminNote ?? null, reviewedAt: now },
    });
    if (proof.ticketOrderId) {
      const order = await prisma.ticketOrder.findUnique({ where: { id: proof.ticketOrderId } });
      await prisma.ticketOrder.update({
        where: { id: proof.ticketOrderId },
        data: {
          statusHistoryJson: pushStatusHistory(order?.statusHistoryJson ?? null, {
            status: "PENDING_PAYMENT",
            at: now.toISOString(),
            note: args.adminNote ? `Transfer rejected: ${args.adminNote}` : "Transfer rejected.",
          }),
        },
      });
    }
    return { ok: true, settledKind: null, status: "REJECTED" };
  }

  // APPROVE → settle only the linked purchase. This is where the purchase
  // really becomes paid/confirmed — driven by admin review of real receipt.
  let settledKind: "FAN_CARD" | "TICKET" | null = null;

  if (proof.paymentId) {
    // Fans-card payment: settle → marks PAID, issues the card.
    const settled = await settlePayment(proof.paymentId, args.origin);
    if (!settled) return { ok: false, status: 500, message: "Could not settle the fan card payment." };
    settledKind = "FAN_CARD";
  } else if (proof.ticketOrderId) {
    const order = await prisma.ticketOrder.findUnique({ where: { id: proof.ticketOrderId } });
    if (!order) return { ok: false, status: 500, message: "Ticket order not found." };
    await prisma.ticketOrder.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paidAt: now,
        amountPaidCents: order.totalCents,
        paymentProvider: "bank-transfer",
        paymentRef: `bt-${proof.id.slice(0, 8)}`,
        deliveryMethod: "OFFICIAL_ACCOUNT",
        deliveryDetail: "Transfer verified by admin. Your official ticket source reference is being prepared.",
        statusHistoryJson: pushStatusHistory(order.statusHistoryJson, {
          status: "CONFIRMED",
          at: now.toISOString(),
          note: args.adminNote ? `Confirmed after transfer verification: ${args.adminNote}` : "Confirmed after transfer verification.",
        }),
      },
    });
    await prisma.ticketTransaction.create({
      data: {
        orderId: order.id,
        kind: "PAYMENT",
        status: "SUCCEEDED",
        amountCents: order.totalCents,
        currency: order.currency,
        provider: "bank-transfer",
        message: "Bank transfer verified by admin.",
      },
    }).catch(() => undefined);
    settledKind = "TICKET";
  } else {
    return { ok: false, status: 400, message: "This proof is not linked to a purchase." };
  }

  await prisma.bankTransferProof.update({
    where: { id: proof.id },
    data: { status: "APPROVED", adminNote: args.adminNote ?? null, reviewedAt: now },
  });

  return { ok: true, settledKind, status: "APPROVED" };
}

// ===== Admin queue lists =====

export async function listPendingBankTransferProofs(): Promise<BankTransferProofPayload[]> {
  const rows = await prisma.bankTransferProof.findMany({
    where: { status: "PENDING_VERIFICATION" },
    include: { bankAccount: { select: { currency: true, countryName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p) => serializeProof(p));
}

export async function getBankTransferProof(proofId: string): Promise<BankTransferProofPayload | null> {
  const row = await prisma.bankTransferProof.findUnique({
    where: { id: proofId },
    include: { bankAccount: { select: { currency: true, countryName: true } } },
  });
  return row ? serializeProof(row) : null;
}