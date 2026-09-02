import type { Metadata } from "next";
import Link from "next/link";
import DirectoryFilters from "@/components/DirectoryFilters";
import CelebrityCard from "@/components/CelebrityCard";
import EmptyState from "@/components/EmptyState";
import { getCelebritySummaries, getSearchOptions } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Celebrity Directory",
  description:
    "Browse official fan card communities for musicians, athletes, actors, artists, creators, and public figures.",
};

export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; country?: string; profession?: string }>;
}) {
  const sp = await searchParams;
  const [celebrities, options] = await Promise.all([
    getCelebritySummaries({
      search: sp.search,
      category: sp.category,
      country: sp.country,
      profession: sp.profession,
    }),
    getSearchOptions(),
  ]);

  const filterCount =
    (sp.search ? 1 : 0) + (sp.category ? 1 : 0) + (sp.country ? 1 : 0) + (sp.profession ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Fan Communities</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Celebrity Directory</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
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
        {celebrities.length === 0 ? (
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {celebrities.map((c) => (
              <CelebrityCard key={c.id} celebrity={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}