import Link from "next/link";
import { isDemoMode, investModeLabel } from "@/lib/invest/mode";

export const dynamic = "force-dynamic";

export default async function InvestLayout({ children }: { children: React.ReactNode }) {
  const demo = await isDemoMode();
  const mode = await investModeLabel();

  return (
    <div className="min-h-screen bg-zinc-950">
      {demo && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
          {mode} — simulated funds only, no real money, no real payouts
        </div>
      )}
      <header className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/invest" className="text-sm font-black uppercase tracking-wide text-white">
            Investor Hub
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/invest" className="rounded-full px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">Overview</Link>
            <Link href="/invest/opportunities" className="rounded-full px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">Investments</Link>
            <Link href="/invest/transactions" className="rounded-full px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">Transactions</Link>
            <Link href="/invest/trust" className="rounded-full px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">Trust &amp; Security</Link>
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white">Fan Cards</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}