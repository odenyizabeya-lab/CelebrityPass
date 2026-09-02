import Link from "next/link";
import CountUp from "@/components/CountUp";
import { formatMoney } from "@/lib/payments";
import { getPlatformStats } from "@/lib/services";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();
  const revenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
    where: { status: "PAID" },
  });
  const collected = revenueAgg._sum.amount ?? 0;
  const pendingCount = await prisma.payment.count({ where: { status: { in: ["PENDING", "FAILED"] } } });
  const [recentFans, recentCards] = await Promise.all([
    prisma.fan.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { _count: { select: { cards: true } } } }),
    prisma.fanCard.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { fan: true, celebrity: true, membershipLevel: true },
    }),
  ]);

  const tiles = [
    { label: "Communities", value: stats.celebrities, to: "/admin/celebrities" },
    { label: "Fan Cards", value: stats.totalCards, to: "/admin/cards" },
    { label: "Registered Fans", value: stats.fans, to: "/admin/fans" },
    { label: "Countries", value: stats.countries, to: "/admin/celebrities" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-zinc-400">Live numbers — always computed from the real database.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.to}
            className="glass card-hover rounded-2xl px-5 py-5"
          >
            <p className="text-3xl font-black text-white">
              <CountUp value={t.value} />
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{t.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick create banner */}
      <div className="glass mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
        <div>
          <h2 className="text-lg font-bold text-white">Add a new celebrity community</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Give a celebrity their own fan community with membership levels and a custom card design.
          </p>
        </div>
        <Link href="/admin/celebrities/new" className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white">
          + New Celebrity
        </Link>
      </div>

      {/* Revenue strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/admin/payments?status=PAID" className="glass card-hover rounded-2xl px-5 py-5">
          <p className="text-2xl font-black text-emerald-300">{formatMoney(collected)}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Collected Revenue</p>
        </Link>
        <Link href="/admin/payments?status=PENDING" className="glass card-hover rounded-2xl px-5 py-5">
          <p className="text-2xl font-black text-amber-300">{pendingCount}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Pending Orders</p>
        </Link>
        <Link href="/admin/payments" className="glass card-hover rounded-2xl px-5 py-5">
          <p className="text-2xl font-black text-white">{revenueAgg._count._all}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Total Transactions</p>
        </Link>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold text-white">Latest Fan Registrations</h2>
          <div className="glass mt-4 overflow-hidden rounded-2xl">
            {recentFans.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-500">No fans have registered yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recentFans.map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-white">{f.name}</p>
                      <p className="text-xs text-zinc-500">{f.email}</p>
                    </div>
                    <p className="font-mono text-xs text-zinc-400">
                      {f._count.cards} card{f._count.cards === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white">Latest Fan Cards Issued</h2>
          <div className="glass mt-4 overflow-hidden rounded-2xl">
            {recentCards.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-500">No cards issued yet. Fans register in real time.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recentCards.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="font-mono text-sm font-semibold text-white">{c.fanNumber}</p>
                      <p className="text-xs text-zinc-500">
                        {c.fan.name} · {c.celebrity.name}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-300",
    SUSPENDED: "bg-amber-500/15 text-amber-300",
    EXPIRED: "bg-zinc-500/15 text-zinc-400",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${map[status] ?? map.ACTIVE}`}>{status}</span>
  );
}