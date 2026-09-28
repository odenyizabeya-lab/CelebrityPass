import type { Metadata } from "next";
import Link from "next/link";
import DirectoryFilters from "@/components/DirectoryFilters";
import CelebrityCard from "@/components/CelebrityCard";
import EmptyState from "@/components/EmptyState";
import T from "@/components/T";
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
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
          <T k="celebrities.eyebrow" />
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          <T k="celebrities.title" />
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400">
          <T k={celebrities.length === 1 ? "celebrities.subOne" : "celebrities.sub"} vars={{ count: celebrities.length }} />
        </p>
      </div>

      <DirectoryFilters categories={options.categories} countries={options.countries} professions={options.professions} />

      {filterCount > 0 && (
        <div className="mt-6 flex items-center gap-3 text-sm text-zinc-400">
          <span>
            <T k={celebrities.length === 1 ? "celebrities.resultPhraseOne" : "celebrities.resultPhrase"} vars={{ count: celebrities.length }} />
          </span>
          <Link href="/celebrities" className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 hover:text-white">
            <T k="celebrities.clearFilters" />
          </Link>
        </div>
      )}

      <div className="mt-8">
        {pageItems.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <EmptyState
              title={<T k="celebrities.noResults" />}
              message={<T k={filterCount > 0 ? "celebrities.noResultsSub" : "celebrities.noActive"} />}
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/celebrities"
                className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 text-white hover:bg-white/5"
              >
                <T k="celebrities.showAll" />
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
                    <T k="celebrities.previous" />
                  </Link>
                )}
                <span className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-zinc-400 ring-1 ring-white/10">
                  <T k="celebrities.pageOf" vars={{ page, total: totalPages }} />
                </span>
                {page < totalPages && (
                  <Link
                    href={pageLinks(page + 1)}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
                  >
                    <T k="celebrities.next" />
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