import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { getOrders, getPositions, getTransactions, quantityToNumber, syncBrokerAccount } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { safeAsync, safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

const day = 86_400_000;

// Total budget for this page's data fetch. If any upstream (broker, market
// data) is slow or down, the page still renders within this window using safe
// fallbacks instead of hanging the first paint.
const PAGE_DATA_BUDGET_MS = 2_500;

export default async function PortfolioPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/invest/portfolio");

  const [account, balances, positions, transactions, orders] = await safeWithDeadline(
    async () =>
      Promise.all([
        safeAsync(() => syncBrokerAccount(fanId), null),
        safeAsync(async () => {
          const inv = await getOrCreateInvestorAccount(fanId);
          return investorBalances(inv.id);
        }, null),
        safeAsync(() => getPositions(fanId), []),
        safeAsync(() => getTransactions(fanId, 30), []),
        safeAsync(() => getOrders(fanId, 30), []),
      ]),
    [null as never, null, [] as never[], [] as never[], [] as never[]],
    PAGE_DATA_BUDGET_MS,
  );

  const holdings = positions.length
    ? await Promise.all(
        positions.map(async (p) => {
          const q = await getQuote(p.symbol);
          const qty = quantityToNumber(p.quantityCents);
          const price = q.price ?? null;
          const avgCost = Number(p.avgCostCents) / 100;
          return {
            symbol: p.symbol,
            companyName: getCompany(p.symbol)?.name ?? p.symbol,
            qty,
            price,
            value: price !== null ? qty * price : null,
            avgCost,
            pnl: price !== null ? qty * (price - avgCost) : null,
            isDemo: p.isDemo,
            accent: getCompany(p.symbol)?.accent ?? "#334155",
          };
        }),
      )
    : [];

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.qty * h.avgCost, 0);
  const totalPnl = holdings.reduce((s, h) => s + (h.pnl ?? 0), 0);
  const hasDemo = holdings.some((h) => h.isDemo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Portfolio</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Holdings, orders and history from your brokerage connection.</p>
      </div>

      {hasDemo && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-amber-400 ring-1 ring-amber-500/20">
          DEMO / PAPER TRADING — these holdings are not real assets
        </p>
      )}

      {/* Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0b0f1a] to-[#0a0d13] p-5 ring-1 ring-white/[0.07]">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Portfolio value</p>
            <p className="mt-1 text-lg font-black text-white">${totalValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total return</p>
            <p className={`mt-1 text-lg font-black ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Available balance</p>
            <p className="mt-1 text-lg font-black text-white">
              ${balances ? Number(balances.cash).toFixed(2) : "0.00"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${
            account?.status === "CONNECTED"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 ring-amber-500/25"
          }`}>
            {account?.status === "CONNECTED" ? "Brokerage connected" : "Broker integration required"}
          </span>
          {totalCost > 0 && (
            <span className="rounded-full bg-white/[0.05] px-3 py-1 font-semibold text-zinc-400 ring-1 ring-white/[0.07]">
              Cost basis ${totalCost.toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/invest/deposit"
            className="btn-grad rounded-full px-5 py-2.5 text-[13px] font-bold text-white"
          >
            Deposit
          </Link>
          <Link
            href="/invest/markets"
            className="rounded-full border border-white/15 px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-white/5"
          >
            Explore markets
          </Link>
        </div>
      </div>

      {/* Holdings */}
      <div>
        <h2 className="text-[15px] font-extrabold text-white">Holdings</h2>
        {holdings.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-[#0a0d13] px-4 py-8 text-center ring-1 ring-white/[0.07]">
            <p className="text-sm font-bold text-white">No holdings yet</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-zinc-500">
              Holdings are created only when an authorized brokerage execution is completed. Explore the markets to see
              eligible securities.
            </p>
            <Link href="/invest/markets" className="btn-grad mt-4 inline-block rounded-full px-6 py-2.5 text-[13px] font-bold text-white">
              Explore markets
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
            {holdings.map((h) => (
              <Link
                key={h.symbol}
                href={`/invest/markets/${h.symbol}`}
                className="block border-b border-white/[0.05] px-4 py-3.5 transition last:border-0 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white" style={{ background: h.accent }}>
                    {h.symbol}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-white">{h.companyName}</p>
                    <p className="text-[11px] text-zinc-500">
                      {h.qty.toFixed(6)} shares · avg {h.price !== null ? `$${h.avgCost.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-extrabold text-white">
                      {h.value !== null ? `$${h.value.toFixed(2)}` : "—"}
                    </p>
                    {h.pnl !== null && (
                      <p className={`text-[12px] font-bold ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Orders */}
      <div>
        <h2 className="text-[15px] font-extrabold text-white">Order history</h2>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#0a0d13] px-4 py-5 text-center text-[12px] text-zinc-500 ring-1 ring-white/[0.07]">
            No orders yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
            {orders.map((o) => {
              const statusCls =
                o.status === "FILLED"
                  ? "text-emerald-400"
                  : o.status === "REJECTED" || o.status === "FAILED" || o.status === "CANCELLED"
                    ? "text-rose-400"
                    : "text-amber-400";
              return (
                <div key={o.id} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-white">
                      {o.side} {quantityToNumber(o.quantityCents).toFixed(4)} {o.symbol}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {o.orderType} · {new Date(o.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {o.rejectReason && <p className="mt-0.5 text-[11px] text-zinc-600">{o.rejectReason}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-white/[0.08] ${statusCls}`}>
                    {o.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-[15px] font-extrabold text-white">Transaction history</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#0a0d13] px-4 py-5 text-center text-[12px] text-zinc-500 ring-1 ring-white/[0.07]">
            No transactions yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-white">{t.kind}</p>
                  <p className="text-[11px] text-zinc-500">
                    {t.ref} · {t.symbol ?? "—"} ·{" "}
                    {t.postedAt
                      ? new Date(t.postedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-extrabold text-white">
                  ${(Number(t.amountCents) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Market value uses the latest provider quote. Positions shown here exist only when a brokerage execution created
        them — database records alone are never presented as ownership.
      </p>
    </div>
  );
}