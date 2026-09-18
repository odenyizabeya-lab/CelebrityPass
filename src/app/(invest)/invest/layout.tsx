import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
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