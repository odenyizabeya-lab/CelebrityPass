import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createFlutterwaveHostedCheckout, getFlutterwaveConfig, isFlutterwaveReady } from "@/lib/payments/flutterwave";
import { postTransaction, settlePendingTransaction, cashAccount, buildBalancedEntries } from "./ledger";
import { getOrCreateInvestorAccount } from "./account";
import { validateInvestAmount, isDemoMode, formatMoney } from "./mode";
import { auditLog, notifyInvestor } from "./audit";

/**
 * REAL card deposit provider for the investor platform.
 *
 * Mirrors the proven fan-card Flutterwave V3 hosted-checkout flow so money
 * genuinely moves (the gateway is already live for memberships and tickets):
 *
 *   1. A PENDING deposit Transaction is created first (nothing hits the
 *      ledger), carrying a stable `tx_ref` → providerRef.
 *   2. Flutterwave's hosted page collects the card — card data never reaches
 *      this server.
 *   3. Settlement happens ONLY via the verified webhook (see
 *      src/app/api/payments/flutterwave/webhook/route.ts): it re-checks the
 *      charge server-side, then settles the pending ledger posting.
 *
 * The frontend can never set a successful state — every credit originates
 * server-side after a verified real charge.
 */

export class InvestDepositError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type DepositIntent = {
  mode: "demo" | "card";
  pendingTxnId: string | null;
  link: string | null;
  txnRef: string | null;
};

/**
 * Create a deposit intent. In demo mode credits the simulated wallet
 * immediately (idempotent per clientRef). In card mode creates the PENDING
 * ledger transaction + a Flutterwave hosted checkout link — the fan is
 * redirected there and the webhook settles the deposit.
 */
export async function createDepositIntent(input: {
  fanId: string;
  amount: Prisma.Decimal;
  clientRef?: string;
  ipAddress?: string | null;
}): Promise<DepositIntent> {
  const error = validateInvestAmount(input.amount);
  if (error) throw new InvestDepositError("AMOUNT_INVALID", error);

  const account = await getOrCreateInvestorAccount(input.fanId, input.ipAddress);
  const demo = await isDemoMode();
  const clientRef = String(input.clientRef ?? "default").trim().slice(0, 60) || "default";

  if (demo) {
    const txn = await createDemoCredits({
      accountId: account.id,
      fanId: input.fanId,
      amount: input.amount,
      clientRef,
      ipAddress: input.ipAddress,
    });
    return { mode: "demo", pendingTxnId: txn.id, link: null, txnRef: txn.txnRef };
  }

  // LIVE — real card charge via Flutterwave hosted checkout.
  const fan = await prisma.fan.findUnique({ where: { id: input.fanId }, select: { name: true, email: true, phone: true } });
  if (!fan) throw new InvestDepositError("NO_FAN", "Your account could not be found.");

  const config = await getFlutterwaveConfig();
  if (!isFlutterwaveReady(config)) {
    throw new InvestDepositError("PAYMENTS_DISABLED", "Card payments aren't enabled on this site yet.");
  }

  // 1) Pending ledger transaction FIRST so the webhook can always find it.
  const pending = await postTransaction({
    investorId: account.id,
    kind: "DEPOSIT",
    direction: "CREDIT",
    amount: input.amount,
    legs: [], // unused while pendingOnly
    pendingOnly: true,
    source: "flutterwave",
    provider: "flutterwave",
    description: `Deposit ${formatMoney(input.amount)}`,
  });

  const txRef = `INVD-${pending.txnRef}`;
  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/payments/flutterwave/callback?ref=${encodeURIComponent(pending.id)}&kind=invest-deposit`;

  const checkout = await createFlutterwaveHostedCheckout({
    txRef,
    amount: input.amount.toNumber(),
    currency: "USD",
    redirectUrl,
    customer: {
      name: fan.name || "Investor",
      email: fan.email || "",
      ...((fan.phone ?? "").trim() ? { phonenumber: fan.phone!.trim() } : {}),
    },
    title: `Investor deposit — ${formatMoney(input.amount)}`,
    description: `Deposit funds into investor account ${account.investorNumber}.`,
  });

  if (!checkout.ok) {
    // The charge never left — abandon the pending transaction.
    await prisma.transaction.update({ where: { id: pending.id }, data: { status: "CANCELLED" } }).catch(() => undefined);
    throw new InvestDepositError("PAYMENT_FAILED", checkout.error);
  }

  // 2) Persist the provider ref BEFORE the fan is redirected so the webhook
  //    can always map the charge back to this pending deposit.
  await prisma.transaction.update({ where: { id: pending.id }, data: { providerRef: txRef } }).catch(() => undefined);

  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "PAYMENT_PENDING",
    entityType: "Transaction",
    entityId: pending.id,
    details: { kind: "DEPOSIT", amount: input.amount.toFixed(2), provider: "flutterwave" },
    ipAddress: input.ipAddress,
  }).catch(() => {});

  return { mode: "card", pendingTxnId: pending.id, link: checkout.link, txnRef: pending.txnRef };
}

/**
 * Settle a pending invest deposit after a verified real card charge (webhook).
 * Lookup is by the stable `providerRef` (the tx_ref saved when the hosted
 * checkout was created). Idempotent — a settled transaction is untouched, so a
 * duplicate webhook never credits twice. Returns "ok" when credited, "ignored"
 * when the reference is unknown/already settled/not a deposit.
 */
export async function settleInvestDepositByProviderRef(
  txRef: string,
  opts?: { gatewayRef?: string | null },
): Promise<{ ok: boolean; settled?: boolean; status?: string }> {
  const txn = await prisma.transaction.findUnique({ where: { providerRef: txRef } });
  if (!txn) return { ok: false };
  if (txn.kind !== "DEPOSIT") return { ok: false };
  if (txn.status === "SUCCESSFUL") return { ok: true, settled: true };
  if (txn.status === "FAILED" || txn.status === "CANCELLED" || txn.status === "REFUNDED" || txn.status === "REVERSED") {
    return { ok: true, settled: false, status: txn.status };
  }

  const result = await settlePendingTransaction({
    txnId: txn.id,
    legs: buildBalancedEntries([
      { account: cashAccount(txn.investorId), amount: txn.amount },
      { account: "platform:liability", amount: txn.amount.negated() },
    ]),
    gatewayEventId: opts?.gatewayRef ?? null,
    providerRef: txRef,
    description: `Deposit confirmed via card (${formatMoney(txn.amount)})`,
  });

  if (result === "settled") {
    await auditLog({
      actorType: "investor",
      actorId: txn.investorId,
      action: "PAYMENT_CONFIRMED",
      entityType: "Transaction",
      entityId: txn.id,
      details: { kind: "DEPOSIT", amount: txn.amount.toFixed(2), provider: "flutterwave", providerRef: txRef },
    }).catch(() => {});
    await notifyInvestor({
      investorId: txn.investorId,
      type: "PAYMENT_CONFIRMED",
      title: "Deposit confirmed",
      body: `${formatMoney(txn.amount)} was credited to your investor account.`,
    }).catch(() => {});
    return { ok: true, settled: true };
  }
  return { ok: true, settled: false, status: txn.status };
}

/** Demo credits — the simulated provider path (kept for DEMO / TEST mode). */
async function createDemoCredits(input: {
  accountId: string;
  fanId: string;
  amount: Prisma.Decimal;
  clientRef: string;
  ipAddress?: string | null;
}) {
  const eventId = `demo-deposit:${input.fanId}:${input.clientRef}`;
  const txn = await postTransaction({
    investorId: input.accountId,
    kind: "DEPOSIT",
    direction: "CREDIT",
    amount: input.amount,
    legs: buildBalancedEntries([
      { account: cashAccount(input.accountId), amount: input.amount },
      { account: "platform:liability", amount: input.amount.negated() },
    ]),
    source: "demo-provider",
    gatewayEventId: eventId,
    providerRef: `demo:${eventId}`,
    provider: "demo",
    description: `Demo deposit ${formatMoney(input.amount)}`,
  });
  await auditLog({
    actorType: "investor",
    actorId: input.fanId,
    action: "PAYMENT_CONFIRMED",
    entityType: "Transaction",
    entityId: txn.id,
    details: { kind: "DEPOSIT", amount: input.amount.toFixed(2), source: "demo-provider" },
    ipAddress: input.ipAddress,
  }).catch(() => {});
  await notifyInvestor({
    investorId: input.accountId,
    type: "PAYMENT_CONFIRMED",
    title: "Demo deposit confirmed",
    body: `${formatMoney(input.amount)} was added to your demo cash balance.`,
  }).catch(() => {});
  return txn;
}