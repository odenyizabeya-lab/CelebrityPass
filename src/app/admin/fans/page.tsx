import { prisma } from "@/lib/db";
import FanRowActions from "@/components/admin/FanRowActions";

export const dynamic = "force-dynamic";

export default async function AdminFansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = q?.trim();

  const where: Record<string, unknown> = {};

  let fans = await prisma.fan.findMany({
    where,
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  if (search) {
    const q = search.toLowerCase();
    fans = fans.filter((f) =>
      [f.name, f.email, f.country].filter(Boolean).some((field) => String(field).toLowerCase().includes(q)),
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Fans</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {fans.length} fan{fans.length === 1 ? "" : "s"}
        {search ? ` matching "${search}"` : " on the platform"}.
      </p>

      <form method="GET" className="mt-6 flex max-w-md gap-2">
        <input
          name="q"
          defaultValue={search ?? ""}
          className="w-full rounded-full border border-white/10 bg-ink-800 px-5 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
          placeholder="Search by name, email, or country…"
        />
        <button className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
          Search
        </button>
      </form>

      <div className="glass mt-6 overflow-hidden rounded-3xl">
        {fans.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-zinc-500">
            {search ? "No fans match this search." : "No fans registered yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-semibold">Fan</th>
                  <th className="px-5 py-3 font-semibold">Country</th>
                  <th className="px-5 py-3 font-semibold">Cards</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {fans.map((f) => (
                  <tr key={f.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-white">{f.name}</p>
                      <p className="text-xs text-zinc-500">{f.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">{f.country ?? "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-300">{f._count.cards}</td>
                    <td className="px-5 py-3.5 text-zinc-400">
                      {f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          f.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-600/20 text-zinc-400"
                        }`}
                      >
                        {f.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <FanRowActions id={f.id} name={f.name} isActive={f.isActive} />
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