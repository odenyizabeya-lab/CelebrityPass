"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CelebrityCard from "@/components/CelebrityCard";
import type { CelebrityCardData } from "@/lib/services";

const PAGE_SIZE = 12;

/**
 * Endless celebrity feed: replaces the old "Browse all" / "Next" dead-ends.
 * As the fan scrolls past the last loaded card, the next page is fetched
 * automatically and appended, so the stream never stops.
 */
export default function InfiniteCelebrityFeed({
  initial,
  excludeIds,
}: {
  initial: CelebrityCardData[];
  excludeIds?: string[];
}) {
  const [items, setItems] = useState<CelebrityCardData[]>(initial);
  const [offset, setOffset] = useState(initial.length);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIds = useRef<Set<string>>(new Set(initial.map((c) => c.id)));
  const fetchRef = useRef(0);

  const loadMore = useCallback(async () => {
    if (loading || done || error) return;
    setLoading(true);
    setError(false);
    const my = ++fetchRef.current;
    try {
      const exclude = excludeIds?.join(",") ?? "";
      const res = await fetch(`/api/celebrities/feed?limit=${PAGE_SIZE}&offset=${offset}&exclude=${exclude}`);
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { items: CelebrityCardData[]; done: boolean };
      if (my !== fetchRef.current) return;
      const fresh = data.items.filter((c) => !seenIds.current.has(c.id));
      fresh.forEach((c) => seenIds.current.add(c.id));
      setItems((prev) => [...prev, ...fresh]);
      setOffset((prev) => prev + data.items.length);
      setDone(data.done);
    } catch {
      if (my !== fetchRef.current) return;
      setError(true);
    } finally {
      if (my === fetchRef.current) setLoading(false);
    }
  }, [loading, done, error, offset, excludeIds]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
            Keep Exploring
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">More Communities</h2>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((c) => (
          <CelebrityCard key={c.id} celebrity={c} />
        ))}
      </div>

      <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-10">
        {loading && (
          <div className="flex items-center gap-3 text-sm font-medium text-zinc-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-primary-400" />
            Loading more communities…
          </div>
        )}
        {error && !done && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-full px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/5"
          >
            Tap to load more
          </button>
        )}
        {done && items.length > 0 && (
          <p className="text-xs font-medium text-zinc-600">
            You&apos;ve reached the end — explore fresh ones next time
          </p>
        )}
      </div>
    </section>
  );
}