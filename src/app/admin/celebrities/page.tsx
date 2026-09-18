import Link from "next/link";
import AdminCelebrityRow from "@/components/admin/AdminCelebrityRow";
import AdminCelebritySearch from "@/components/admin/AdminCelebritySearch";
import { prisma } from "@/lib/db";
import { celebrityImageFlags } from "@/lib/images";

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

  const [celebrities, imageFlags] = await Promise.all([
    prisma.celebrity.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        country: true,
        profession: true,
        accentColor: true,
        isVerified: true,
        isFeatured: true,
        isActive: true,
        profileType: true,
        fansCardEnabled: true,
        _count: { select: { fans: true, memberships: true } },
      },
    }),
    celebrityImageFlags(),
  ]);

  const totalCount = await prisma.celebrity.count();

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-b from-primary-500/10 to-transparent px-2 pb-8 pt-4 sm:px-4">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-primary-400">
          Celebrity profiles
        </p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
          Find anyone to edit
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-zinc-400">
          Type a name and pick the profile you want — you’ll land right in its editor.
        </p>
        <div className="mt-6">
          <AdminCelebritySearch />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-200">All celebrities</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            {totalCount} {totalCount === 1 ? "community" : "communities"} · showing {celebrities.length}
          </p>
        </div>
        <Link href="/admin/celebrities/new" prefetch className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white">
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
              <AdminCelebrityRow
                key={c.id}
                id={c.id}
                slug={c.slug}
                name={c.name}
                country={c.country}
                profession={c.profession}
                accentColor={c.accentColor}
                isVerified={c.isVerified}
                isFeatured={c.isFeatured}
                isActive={c.isActive}
                profileType={c.profileType}
                fansCardEnabled={c.fansCardEnabled}
                fans={c._count.fans}
                levels={c._count.memberships}
                hasProfile={Boolean(imageFlags.get(c.slug)?.hasProfile)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}