import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount, getInvestorAccountByFan } from "@/lib/invest/account";
import { investorBalances, positionBookValue } from "@/lib/invest/ledger";
import { isDemoMode, formatMoney } from "@/lib/invest/mode";
import { listInvestorTransactions, listInvestorPositions } from "@/lib/invest/orders";
import { safeAsync } from "@/lib/safe-data";
import DepositForm from "@/components/invest/DepositForm";
import WithdrawForm from "@/components/invest/WithdrawForm";
import KycForm from "@/components/invest/KycForm";

export const dynamic = "force-dynamic";

export default async function InvestHubPage(props: { searchParams?: Promise<{ deposit?: string }> }) {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/invest");
  const { deposit } = (await props.searchParams) ?? {};

  const [account, kyc, recentTx, positions] = await Promise.all([
    safeAsync(() => getOrCreateInvestorAccount(fanId), null),
    safeAsync(async () => {
      const a = await getInvestorAccountByFan(fanId);
      if (!a) return null;
      return prisma.kycRecord.findUnique({ where: { investorId: a.id } });
    }, null),
    safeAsync(() => listInvestorTransactions(fanId), null),
    safeAsync(() => listInvestorPositions(fanId), null),
  ]);
  const balances = account ? await safeAsync(() => investorBalances(account.id), null) : null;
  const positionValues =
    account && positions
      ? await Promise.all(
          positions.map(async (p) => {
            const value = await safeAsync(() => positionBookValue(account.id, p.opportunity.id), null);
            return value ?? p.amount;
          }),
        )
      : [];

  const demo = await isDemoMode();

  if (!account) {
    return (
      <Main>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="font-bold text-white">Investor account unavailable</p>
          <p className="mt-2 text-sm text-zinc-400">We could not load your account right now.</p>
        </div>
      </Main>
    );
  }

  return (
    <Main>
      {deposit && (
        <div className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-200">
          {deposit === "confirmed"
            ? "Deposit confirmed — your funds are in your investor ledger."
            : deposit === "failed"
              ? "Your deposit was not completed. No money was moved. Try again or use Bank Transfer."
              : `Your deposit was ${deposit}.`}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Investor Hub</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Your investor account</h1>
          <p className="mt-2 text-sm text-zinc-400">Account #{account.investorNumber} · {demo ? "DEMO / TEST environment" : "Live environment"}</p>
        </div>
        <Link href="/invest/opportunities" className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Browse investments
        </Link>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <StatCard label="Available cash" value={balances ? formatMoney(balances.cash) : "$0.00"} sub="Ledger-backed balance" />
        <StatCard label="Invested" value={balances ? formatMoney(balances.invested) : "$0.00"} sub="Confirmed positions only" />
        <StatCard
          label="Total value"
          value={balances ? formatMoney(balances.total) : "$0.00"}
          sub="No invented mark-to-market"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-extrabold text-white">{demo ? "Add demo funds" : "Deposit funds"}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {demo
              ? "Top up your simulated cash balance. No real money moves — ever, in demo mode."
              : "Pay with your ATM / debit / credit card. Your deposit lands in your investor ledger after the charge is verified."}
          </p>
          <DepositForm cardEnabled={!demo} />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-extrabold text-white">Withdraw cash</h2>
          <p className="mt-1 text-sm text-zinc-400">Requests are reviewed and completed by the backend only.</p>
          <WithdrawForm kycStatus={account.kycStatus} />
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-extrabold text-white">Identity verification (KYC)</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Status: <span className="font-bold text-white">{kycLabel(account.kycStatus)}</span>.
            Nothing is auto-approved — an administrator records every decision.
          </p>
          <KycForm kycStatus={account.kycStatus} existing={kyc} />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-extrabold text-white">Recent activity</h2>
          {recentTx && recentTx.length > 0 ? (
            <ul className="mt-3 divide-y divide-zinc-800 text-sm">
              {recentTx.slice(0, 6).map((t) => (
                <li key={t.txnRef} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-semibold text-white">{t.description ?? t.kind}</p>
                    <p className="text-xs text-zinc-500">{t.txnRef}</p>
                  </div>
                  <span className={t.direction === "CREDIT" ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
                    {t.direction === "CREDIT" ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No activity yet. Deposits and subscriptions will appear here.</p>
          )}
          <Link href="/invest/transactions" className="mt-3 inline-block text-sm font-bold text-primary-400 hover:text-primary-300">
            View all activity →
          </Link>
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-white">My positions</h2>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            NO PERFORMANCE DATA AVAILABLE
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          You see only ledger-verified facts: what you deposited, invested, and withdrew. This platform does not show
          gains or losses — no invented mark-to-market, no estimated returns — until a real distribution or valuation is
          recorded by the backend, and none exists today.
        </p>
        {positions && positions.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-800 text-sm">
            {positions.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/invest/opportunities/${p.opportunity.slug}`} className="font-semibold text-white hover:text-primary-300">
                    {p.opportunity.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {p.opportunity.investmentType.replaceAll("_", " ")} · since {formatDate(p.acquiredAt)} · {positionStatusLabel(p.status)}
                  </p>
                </div>
                <span className="font-bold text-white">{formatMoney(positionValues[i] ?? p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">No positions yet. Browse investments and subscribe when you are ready.</p>
        )}
      </section>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function positionStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE": return "Active";
    case "SOLD": return "Sold";
    case "CANCELLED": return "Cancelled";
    case "CALLED": return "Called";
    default: return status;
  }
}

function kycLabel(status: string): string {
  switch (status) {
    case "VERIFIED": return "Verified";
    case "PENDING": return "Pending review";
    case "UNDER_REVIEW": return "Under review";
    case "REJECTED": return "Rejected";
    case "ADDITIONAL_INFORMATION_REQUIRED": return "More info required";
    default: return "Not started";
  }
}