import Link from "next/link";
import { listOpportunities, isAcceptingFunds } from "@/lib/invest/opportunities";
import { formatMoney } from "@/lib/invest/mode";

export const dynamic = "force-dynamic";

export default async function InvestOpportunitiesPage() {
  const opps = await listOpportunities({ onlyOpen: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Investor Hub</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Investment opportunities</h1>
      <p className="mt-2 text-sm text-zinc-400">Open offerings only. Every amount shown is ledger-backed — no fabricated valuations.</p>

      {opps.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="font-bold text-white">No open opportunities</p>
          <p className="mt-2 text-sm text-zinc-400">More offerings may be added. Check back soon.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {opps.map((o) => {
            const open = isAcceptingFunds(o);
            const pct = o.targetAmount && o.targetAmount.gt(0) ? Math.min(100, Math.round(o.raisedAmount.div(o.targetAmount).toNumber() * 100)) : null;
            return (
              <Link key={o.id} href={`/invest/opportunities/${o.slug}`} className="group rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-primary-500/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{o.investmentType.replaceAll("_", " ")}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {open ? "Open" : "Closed"}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-extrabold text-white group-hover:text-primary-300">{o.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{o.companyName}</p>
                <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{o.description}</p>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">
                    From <span className="font-bold text-white">{o.minAmount ? formatMoney(o.minAmount) : "—"}</span>
                  </span>
                  <span className="text-zinc-300">
                    Raised <span className="font-bold text-white">{formatMoney(o.raisedAmount)}</span>
                    {o.targetAmount ? ` / ${formatMoney(o.targetAmount)}` : ""}
                  </span>
                </div>
                {pct != null && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}