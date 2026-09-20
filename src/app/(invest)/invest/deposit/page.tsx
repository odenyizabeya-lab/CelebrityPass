import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { prisma } from "@/lib/db";
import { safeAsync } from "@/lib/safe-data";
import DepositFlow from "@/components/invest/deposit/DepositFlow";
import DepositHistory, { DepositHistorySkeleton } from "@/components/invest/deposit/DepositHistory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DepositPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/invest/deposit");

  // The balance renders instantly; history loads independently in its own
  // suspense boundary so a slow history query never blocks the deposit flow.
  const cash = await safeAsync(async () => {
    const account = await getOrCreateInvestorAccount(fanId);
    if (!account) return 0;
    const bal = await investorBalances(account.id);
    return bal ? Number(bal.cash) : 0;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Native-app balance hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101427] via-[#0b0f1d] to-[#080a12] p-5 ring-1 ring-white/[0.08]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-primary-600/20 blur-[70px]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Deposit</p>
        <p className="mt-2 text-[12px] font-semibold text-zinc-400">Your available balance</p>
        <p className="mt-0.5 text-[40px] font-black leading-none tracking-tight text-white">{fmtMoney(cash)}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Available balance is credited only after a deposit is verified. Your balance can never be changed by the form
          — the backend is the source of truth.
        </p>
      </section>

      {/* Deposit flow: amount + payment method */}
      <section>
        <DepositFlow />
      </section>

      {/* Deposit history — loaded independently, never blocks the flow */}
      <section>
        <Suspense fallback={<DepositHistorySkeleton />}>
          <HistoryBoundary fanId={fanId} />
        </Suspense>
      </section>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Transfers are matched to your unique deposit reference and verified before any credit. Nothing is credited on
        your word alone.{" "}
        <Link href="/invest/more/investing" className="font-bold text-primary-400">
          How investing works ›
        </Link>
      </p>
    </div>
  );
}

async function HistoryBoundary({ fanId }: { fanId: string }) {
  const account = await safeAsync(() => getOrCreateInvestorAccount(fanId), null);
  if (!account) return <DepositHistory deposits={[]} />;

  const [rows, proofs] = await Promise.all([
    safeAsync(
      () =>
        prisma.transaction.findMany({
          where: { investorId: account.id, kind: "DEPOSIT" },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true,
            txnRef: true,
            providerRef: true,
            amount: true,
            status: true,
            createdAt: true,
            provider: true,
          },
        }),
      [],
    ),
    safeAsync(
      () =>
        prisma.bankTransferProof.findMany({
          where: { transaction: { investorId: account.id, kind: "DEPOSIT" } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { transactionId: true, method: true, status: true },
        }),
      [],
    ),
  ]);

  const proofByTxn = new Map(proofs.map((p) => [p.transactionId, p]));

  const deposits = rows.map((t) => {
    const proof = proofByTxn.get(t.id);
    return {
      id: t.id,
      ref: t.txnRef,
      amount: Number(t.amount),
      status: proof?.status ?? t.status,
      createdAt: t.createdAt.toISOString(),
      depositRef: t.providerRef,
      method: (proof?.method as "BANK_TRANSFER" | "ATM_DEPOSIT" | null | undefined) ?? null,
    };
  });

  return <DepositHistory deposits={deposits} />;
}