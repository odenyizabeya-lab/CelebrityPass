import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { getOrders, getPositions, getTransactions, quantityToNumber, syncBrokerAccount } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { safeAsync, safeWithDeadline } from "@/lib/safe-data";
import { CompanyTile, Eye, NativeCard, SectionTitle, PrimaryAction, SecondaryAction } from "@/components/invest-app/native";

export const dynamic = "force-dynamic";

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
          const company = getCompany(p.symbol);
          const qty = quantityToNumber(p.quantityCents);
          const price = q.price ?? null;
          const avgCost = Number(p.avgCostCents) / 100;
          return {
            symbol: p.symbol,
            mono: company?.mono ?? p.symbol,
            companyName: company?.name ?? p.symbol,
            qty,
            price,
            value: price !== null ? qty * price : null,
            avgCost,
            pnl: price !== null ? qty * (price - avgCost) : null,
            isDemo: p.isDemo,
            accent: company?.accent ?? "#334155",
            exchange: company?.exchange ?? "—",
          };
        }),
      )
    : [];

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.qty * h.avgCost, 0);
  const totalPnl = holdings.reduce((s, h) => s + (h.pnl ?? 0), 0);
  const cash = balances ? Number(balances.cash) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">Portfolio</p>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">Your holdings</h1>
      </div>

      {/* Summary */}
      <NativeCard className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary-600/15 blur-[70px]" />
        <div className="grid grid-cols-3 gap-5">
          <div>
            <Eye>Portfolio value</Eye>
            <p className="mt-1 text-[28px] font-black leading-none tracking-tight text-white">${totalValue.toFixed(2)}</p>
          </div>
          <div>
            <Eye>Total return</Eye>
            <p className={`mt-1 text-[28px] font-black leading-none tracking-tight ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          </div>
          <div>
            <Eye>Cash</Eye>
            <p className="mt-1 text-[28px] font-black leading-none tracking-tight text-white">${cash.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
          <span className={`rounded-full px-3 py-1 font-bold ring-1 ${
            account?.status === "CONNECTED"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 ring-amber-500/25"
          }`}>
            {account?.status === "CONNECTED" ? "Brokerage connected" : "Broker integration required"}
          </span>
          {totalCost > 0 && (
            <span className="rounded-full bg-white/[0.05] px-3 py-1 font-bold text-zinc-400 ring-1 ring-white/[0.07]">
              Cost basis ${totalCost.toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <PrimaryAction href="/invest/deposit" className="rounded-2xl py-3.5 text-[14px]">
            Deposit
          </PrimaryAction>
          <SecondaryAction href="/invest/markets" className="rounded-2xl py-3.5 text-[14px]">
            Explore markets
          </SecondaryAction>
        </div>
      </NativeCard>

      {/* Holdings */}
      <section className="fade-up">
        <SectionTitle>Holdings</SectionTitle>
        {holdings.length === 0 ? (
          <NativeCard className="mt-3 px-5 py-10 text-center">
            <p className="text-[17px] font-bold text-white">No holdings yet</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-zinc-500">
              Holdings are created only when an authorized brokerage execution is completed. Explore the markets to see
              eligible securities.
            </p>
            <Link href="/invest/markets" className="btn-grad mt-5 inline-block rounded-2xl px-7 py-3 text-[14px] font-black text-white">
              Explore markets
            </Link>
          </NativeCard>
        ) : (
          <NativeCard className="mt-3 divide-y divide-white/[0.06]">
            {holdings.map((h) => (
              <Link
                key={h.symbol}
                href={`/invest/markets/${h.symbol}`}
                className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
              >
                <CompanyTile symbol={h.mono} ticker={h.symbol} accent={h.accent} />
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block text-[15px] leading-snug font-bold text-white">{h.companyName}</span>
                  <span className="mt-1 block text-[12px] leading-snug text-zinc-500">
                    {h.symbol} · {h.exchange}{" "}
                    <span className="text-zinc-600">· {h.qty.toFixed(6)} sh</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-zinc-600">Avg ${h.avgCost.toFixed(2)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[16px] font-extrabold tracking-tight text-white">
                    {h.value !== null ? `$${h.value.toFixed(2)}` : "—"}
                  </span>
                  {h.pnl !== null && (
                    <span className={`block text-[12px] font-bold ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </NativeCard>
        )}
      </section>

      {/* Orders */}
      <section className="fade-up">
        <SectionTitle>Order history</SectionTitle>
        {orders.length === 0 ? (
          <NativeCard className="mt-3 px-5 py-8 text-center">
            <p className="text-[14px] font-bold text-white">No orders yet</p>
          </NativeCard>
        ) : (
          <NativeCard className="mt-3 divide-y divide-white/[0.06]">
            {orders.map((o) => {
              const statusCls =
                o.status === "FILLED"
                  ? "text-emerald-400 ring-emerald-500/30 bg-emerald-500/10"
                  : o.status === "REJECTED" || o.status === "FAILED" || o.status === "CANCELLED"
                    ? "text-rose-400 ring-rose-500/30 bg-rose-500/10"
                    : "text-amber-400 ring-amber-500/30 bg-amber-500/10";
              return (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-white">
                      {o.side} {quantityToNumber(o.quantityCents).toFixed(4)} {o.symbol}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {o.orderType} · {new Date(o.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {o.rejectReason && <p className="mt-0.5 text-[11px] text-zinc-600">{o.rejectReason}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ring-1 ${statusCls}`}>
                    {o.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </NativeCard>
        )}
      </section>

      {/* Transactions */}
      <section className="fade-up">
        <SectionTitle>Transaction history</SectionTitle>
        {transactions.length === 0 ? (
          <NativeCard className="mt-3 px-5 py-8 text-center">
            <p className="text-[14px] font-bold text-white">No transactions yet</p>
          </NativeCard>
        ) : (
          <NativeCard className="mt-3 divide-y divide-white/[0.06]">
            {transactions.map((t) => {
              const deposit = t.kind === "DEPOSIT";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[14px] font-black ${
                      deposit ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
                    }`}
                  >
                    {deposit ? "↓" : "↗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="block text-[14px] leading-snug font-bold text-white">{t.kind.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {t.ref} {t.symbol ? `· ${t.symbol}` : ""} ·{" "}
                      {t.postedAt
                        ? new Date(t.postedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                        : new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[15px] font-extrabold ${deposit ? "text-emerald-400" : "text-white"}`}>
                    ${(Number(t.amountCents) / 100).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </NativeCard>
        )}
      </section>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Market value uses the latest provider quote. Positions shown here exist only when a brokerage execution created
        them — database records alone are never presented as ownership.
      </p>
    </div>
  );
}