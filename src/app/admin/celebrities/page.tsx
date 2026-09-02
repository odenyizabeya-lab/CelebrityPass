import Image from "next/image";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "all";

  const where: Record<string, unknown> = {};
  if (status === "active") where.isActive = true;
  if (status === "hidden") where.isActive = false;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { profession: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const celebrities = await prisma.celebrity.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { fans: true, memberships: true } } },
  });

  const totalCount = await prisma.celebrity.count();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Celebrities</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {totalCount} {totalCount === 1 ? "community" : "communities"} · showing {celebrities.length}
          </p>
        </div>
        <Link href="/admin/celebrities/new" className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white">
          + New Celebrity
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form method="GET" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, country, profession…"
              className="w-full rounded-full border border-white/10 bg-ink-800 py-2.5 pl-11 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
            />
          </div>
          <button type="submit" className="rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5">
            Search
          </button>
          {(q || status !== "all") && (
            <Link href="/admin/celebrities" className="rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-400 transition hover:text-white">
              Clear
            </Link>
          )}
        </form>
        <div className="flex rounded-full p-1 ring-1 ring-white/10">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["hidden", "Hidden"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={q ? `/admin/celebrities?q=${encodeURIComponent(q)}&status=${key}` : `/admin/celebrities?status=${key}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                status === key ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="glass mt-4 overflow-hidden rounded-3xl">
        {celebrities.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-zinc-500">
            {q || status !== "all" ? "No celebrities match this search." : "No communities yet. Create your first celebrity."}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {celebrities.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  {c.profileImage ? (
                    <Image src={c.profileImage} alt="" width={48} height={60} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-bold text-white" style={{ backgroundColor: c.accentColor }}>
                      {c.name[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex items-center gap-1 font-bold text-white">
                      {c.name}
                      <VerifiedBadge className="h-3.5 w-3.5" />
                    </p>
                    {c.isFeatured && <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold text-gold-400">★ Featured</span>}
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    /celebrity/{c.slug} · {c.profession} · {c.country}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-xs text-zinc-400">
                  <span title="Fans">{c._count.fans} fans</span>
                  <span title="Membership levels">{c._count.memberships} levels</span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-bold ${c.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-600/20 text-zinc-400"}`}
                  >
                    {c.isActive ? "Active" : "Hidden"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/celebrities/${c.id}`}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/celebrity/${c.slug}`}
                    className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:text-white sm:inline-flex"
                  >
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}