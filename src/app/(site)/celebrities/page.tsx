import type { Metadata } from "next";
import Link from "next/link";
import DirectoryFilters from "@/components/DirectoryFilters";
import CelebrityCard from "@/components/CelebrityCard";
import EmptyState from "@/components/EmptyState";
import { getCelebritySummaries, getSearchOptions, toCardCelebrity } from "@/lib/services";
import { safeAsync } from "@/lib/safe-data";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const APP_URL = appUrl();

export const metadata: Metadata = {
  title: "Celebrity Directory",
  description:
    "Browse official fan card communities for musicians, athletes, actors, artists, creators, and public figures.",
  alternates: { canonical: `${APP_URL}/celebrities` },
  openGraph: {
    type: "website",
    url: `${APP_URL}/celebrities`,
    siteName: "CelebrityPass",
    title: "Celebrity Directory",
    description:
      "Browse official fan card communities for musicians, athletes, actors, artists, creators, and public figures.",
  },
  twitter: {
    card: "summary",
    title: "Celebrity Directory",
    description:
      "Browse official fan card communities for musicians, athletes, actors, artists, creators, and public figures.",
  },
};

export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; country?: string; profession?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const PAGE_SIZE = 24;
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const filters = {
    search: sp.search,
    category: sp.category,
    country: sp.country,
    profession: sp.profession,
  };
  // Failures degrade to an empty directory (plus empty filter options), keeping
  // the page shell alive and letting the empty-state explain itself.
  const [celebrities, options] = await Promise.all([
    safeAsync(
      () => getCelebritySummaries(filters),
      [],
    ),
    safeAsync(
      () =>
        getSearchOptions().then((o) => ({ categories: o.categories, countries: o.countries, professions: o.professions })),
      { categories: [], countries: [], professions: [] },
    ),
  ]);

  const total = celebrities.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pageNum, totalPages);
  const pageItems = celebrities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterCount =
    (sp.search ? 1 : 0) + (sp.category ? 1 : 0) + (sp.country ? 1 : 0) + (sp.profession ? 1 : 0);

  const pageLinks = (target: number) => {
    const params = new URLSearchParams();
    for (const k of ["search", "category", "country", "profession"] as const) {
      const v = sp[k];
      if (v) params.set(k, v);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/celebrities?${qs}` : "/celebrities";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      {pageItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: "Celebrity Directory",
              itemListElement: pageItems.map((c, i) => ({
                "@type": "ListItem",
                position: (page - 1) * PAGE_SIZE + i + 1,
                name: c.name,
                url: `${APP_URL}/celebrity/${c.slug}`,
                ...(c.profileImageUrl ? { image: `${APP_URL}${c.profileImageUrl}` } : {}),
              })),
            }),
          }}
        />
      )}
      <div className="mb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Fan Communities</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Celebrity Directory</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400">
          {celebrities.length} active {celebrities.length === 1 ? "community" : "communities"} · search, filter, and
          enter any fan community to claim your official card.
        </p>
      </div>

      <DirectoryFilters categories={options.categories} countries={options.countries} professions={options.professions} />

      {filterCount > 0 && (
        <div className="mt-6 flex items-center gap-3 text-sm text-zinc-400">
          <span>
            {celebrities.length} result{celebrities.length === 1 ? "" : "s"} for your search
          </span>
          <Link href="/celebrities" className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 hover:text-white">
            Clear filters
          </Link>
        </div>
      )}

      <div className="mt-8">
        {pageItems.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <EmptyState
              title="No communities found"
              message={
                filterCount > 0
                  ? "Nothing matched your search. Try a different name, category, country, or profession."
                  : "There are no active communities yet. Check back soon."
              }
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/celebrities"
                className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 text-white hover:bg-white/5"
              >
                Show all communities
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((c) => (
                <CelebrityCard key={c.id} celebrity={toCardCelebrity(c)} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                {page > 1 && (
                  <Link
                    href={pageLinks(page - 1)}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
                  >
                    ← Previous
                  </Link>
                )}
                <span className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-zinc-400 ring-1 ring-white/10">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={pageLinks(page + 1)}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}