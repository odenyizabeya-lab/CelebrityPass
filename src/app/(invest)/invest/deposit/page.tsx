import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { prisma } from "@/lib/db";
import { safeAsync } from "@/lib/safe-data";
import DepositFlow from "@/components/invest/deposit/DepositFlow";

export const dynamic = "force-dynamic";

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusCls(status: string): string {
  switch (status) {
    case "SUCCESSFUL":
    case "COMPLETED":
    case "APPROVED":
      return "text-emerald-400";
    case "PENDING":
      return "text-amber-400";
    case "FAILED":
    case "CANCELLED":
    case "REFUNDED":
    case "REVERSED":
    case "REJECTED":
      return "text-rose-400";
    default:
      return "text-zinc-400";
  }
}

function methodLabel(method: string | null | undefined): string {
  if (method === "ATM_DEPOSIT" || method === "atm-deposit") return "ATM";
  return "Bank Transfer";
}

export default async function DepositPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/invest/deposit");

  const [account, _balances] = await Promise.all([
    safeAsync(() => getOrCreateInvestorAccount(fanId), null),
    null,
  ]);

  let cash = 0;
  let deposits: {
    id: string;
    ref: string | null;
    amount: number;
    status: string;
    createdAt: Date;
    providerRef: string | null;
    provider: string | null;
    method: string | null;
  }[] = [];
  if (account) {
    const [bal, rows] = await Promise.all([
      safeAsync(() => investorBalances(account.id), null),
      safeAsync(
        () =>
          prisma.transaction.findMany({
            where: { investorId: account.id, kind: "DEPOSIT" },
            orderBy: { createdAt: "desc" },
            take: 20,
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
    ]);
    cash = bal ? Number(bal.cash) : 0;
    deposits = rows.map((t) => ({
      id: t.id,
      ref: t.txnRef,
      amount: Number(t.amount),
      status: t.status,
      createdAt: t.createdAt,
      providerRef: t.providerRef,
      provider: t.provider,
      method: null,
    }));
  }

  const methodInfo: Record<string, { label: string; emoji: string }> = {};
  for (const d of deposits) {
    const proof = await safeAsync(
      () =>
        prisma.bankTransferProof.findFirst({
          where: { transactionId: d.id },
          select: { method: true, status: true },
        }),
      null,
    );
    if (proof) {
      methodInfo[d.id] = {
        label: methodLabel(proof.method),
        emoji: proof.method === "ATM_DEPOSIT" ? "🏧" : "🏦",
      };
    }
  }

  deposits = deposits.map((t) => {
    const mi = methodInfo[t.id];
    return {
      ...t,
      method: mi ? `${mi.emoji} ${mi.label}` : t.provider === "atm-deposit" ? "🏧 ATM" : t.provider === "bank-transfer" ? "🏦 Bank Transfer" : null,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Deposit money</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Pay from your bank or an ATM and we&apos;ll credit your investing cash once the transfer is confirmed.
        </p>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0b0f1a] to-[#0a0d13] p-5 ring-1 ring-white/[0.07]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Investing cash available</p>
        <p className="mt-1 text-3xl font-black tracking-tight text-white">{fmtMoney(cash)}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Confirmed cash credited to your investor account. Deposits are not investments — they are the funds you choose
          to invest with.
        </p>
        <span className="mt-3 inline-block rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-bold text-zinc-400 ring-1 ring-white/[0.07]">
          Paid by Bank Transfer / ATM
        </span>
      </div>

      {/* Deposit form */}
      <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
        <h2 className="text-[15px] font-extrabold text-white">Start a deposit</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
          Choose a payment method, pay with your unique reference, then upload your transfer receipt or ATM slip. Your
          cash is credited only after our team verifies the real transfer.
        </p>
        <DepositFlow />
      </div>

      {/* Deposit history */}
      <div>
        <h2 className="text-[15px] font-extrabold text-white">Deposit history</h2>
        {deposits.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#0a0d13] px-4 py-5 text-center text-[12px] text-zinc-500 ring-1 ring-white/[0.07]">
            No deposits yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
            {deposits.map((t) => (
              <div key={t.ref ?? t.createdAt.toISOString()} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white">{t.ref ?? "Deposit"}</p>
                  <p className="text-[11px] text-zinc-500">
                    {t.method ? `${t.method} · ` : ""}
                    {t.providerRef ? `${t.providerRef} · ` : ""}
                    {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-extrabold text-white">{fmtMoney(t.amount)}</p>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${statusCls(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Transfers are matched to your unique deposit reference and verified before any credit. Nothing is credited on
        your word alone.
        <Link href="/invest/more/investing" className="ml-1 font-bold text-sky-400">
          How investing works ›
        </Link>
      </p>
    </div>
  );
}