import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { formatMoney } from "@/lib/invest/mode";
import { listInvestorTransactions } from "@/lib/invest/orders";

export const dynamic = "force-dynamic";

export default async function InvestTransactionsPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/invest/transactions");

  const txns = await listInvestorTransactions(fanId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Investor Hub</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Transaction history</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Every entry is a ledger-posted transaction. Balances are derived from these rows — nothing is typed in.
          </p>
        </div>
        <Link href="/invest" className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">
          Back to overview
        </Link>
      </div>

      {txns.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="font-bold text-white">No transactions yet</p>
          <p className="mt-2 text-sm text-zinc-400">Deposits, subscriptions, and withdrawals will appear here.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-5 py-3 font-bold">Date</th>
                <th className="px-5 py-3 font-bold">Reference</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Description</th>
                <th className="px-5 py-3 text-right font-bold">Amount</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {txns.map((t) => (
                <tr key={t.txnRef} className="hover:bg-zinc-800/30">
                  <td className="whitespace-nowrap px-5 py-3 text-zinc-400">{formatDateTime(t.postedAt ?? t.createdAt)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-zinc-300">{t.txnRef}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-zinc-300">{txnKindLabel(t.kind)}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-zinc-400">{t.description ?? "—"}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-right font-bold ${t.direction === "CREDIT" ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.direction === "CREDIT" ? "+" : "−"}{formatMoney(t.amount)} {t.currency}
                  </td>
                  <td className="px-5 py-3 text-zinc-300">{t.status}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function txnKindLabel(kind: string): string {
  switch (kind) {
    case "DEPOSIT": return "Deposit";
    case "INVESTMENT": return "Investment";
    case "WITHDRAWAL": return "Withdrawal";
    case "DISTRIBUTION": return "Distribution";
    case "FEE": return "Fee";
    case "REFUND": return "Refund";
    case "ADJUSTMENT": return "Adjustment";
    default: return kind;
  }
}