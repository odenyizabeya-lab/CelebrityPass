"use client";

import { useMemo, useState } from "react";
import { FAQS, type Faq } from "@/lib/faqs";

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set([]));

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? FAQS.filter((f) => (f.q + " " + f.a + " " + f.topic).toLowerCase().includes(q))
      : FAQS;
    const map = new Map<string, Faq[]>();
    for (const faq of filtered) {
      const arr = map.get(faq.topic) ?? [];
      arr.push(faq);
      map.set(faq.topic, arr);
    }
    return map;
  }, [query]);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const total = useMemo(() => FAQS.length, []);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          className="w-full rounded-2xl border border-white/10 bg-ink-800 py-4 pl-12 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {query.trim() ? `Showing results for "${query.trim()}"` : `${total} articles across the Help Center`}
      </p>

      {/* Results */}
      {grouped.size === 0 ? (
        <div className="glass mt-6 rounded-3xl px-6 py-14 text-center">
          <h3 className="text-lg font-bold text-white">No results found</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            We couldn&apos;t find an article matching your search. Try different keywords, or contact our{" "}
            <a href="/legal/contact" className="text-primary-400 underline">support team</a>.
          </p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([topic, faqs]) => (
          <section key={topic} className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{topic}</h2>
            <div className="mt-3 space-y-3">
              {faqs.map((faq) => {
                const key = `${topic}:${faq.q}`;
                const isOpen = open.has(key);
                return (
                  <div key={key} className="glass overflow-hidden rounded-2xl">
                    <button
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-white sm:text-base">{faq.q}</span>
                      <svg
                        className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-45" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {isOpen && (
                      <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{faq.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
