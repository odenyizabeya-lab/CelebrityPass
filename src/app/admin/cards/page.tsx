import { prisma } from "@/lib/db";
import { listAdminCards } from "@/lib/services";
import CardRowActions from "@/components/admin/CardRowActions";
import IssueCardForm from "@/components/admin/IssueCardForm";

export const dynamic = "force-dynamic";

export default async function AdminCardsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const cards = await listAdminCards({ search: sp.q, status: sp.status });
  const celebrities = await prisma.celebrity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const statusOptions = ["ACTIVE", "SUSPENDED", "EXPIRED"] as const;

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Cards</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {cards.length} card{cards.length === 1 ? "" : "s"}
        {sp.status ? ` with status ${sp.status}` : ""}
        {sp.q ? ` matching "${sp.q}"` : ""}.
      </p>

      <form method="GET" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          className="w-full max-w-sm rounded-full border border-white/10 bg-ink-800 px-5 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
          placeholder="Search FC-…, fan name, email, or celebrity…"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-full border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
          Filter
        </button>
        {(sp.q || sp.status) && (
          <a href="/admin/cards" className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:text-white">
            Clear
          </a>
        )}
      </form>

      <IssueCardForm celebrities={celebrities} />

      <div className="glass mt-8 overflow-hidden rounded-3xl">
        {cards.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-zinc-500">No cards match these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-semibold">Fan ID</th>
                  <th className="px-5 py-3 font-semibold">Fan</th>
                  <th className="px-5 py-3 font-semibold">Community</th>
                  <th className="px-5 py-3 font-semibold">Level</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Issued</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {cards.map((c) => (
                  <tr key={c.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <a
                        href={`/celebrity/${c.celebritySlug}/fan/${c.fanNumber}`}
                        className="font-mono font-bold text-primary-300 transition hover:text-primary-200"
                      >
                        {c.fanNumber}
                      </a>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-white">{c.fanName}</p>
                      <p className="text-xs text-zinc-500">{c.fanEmail}</p>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">{c.celebrityName}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{c.membershipName ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">
                      {c.registeredAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <CardRowActions card={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${map[status] ?? map.ACTIVE}`}>{status}</span>;
}