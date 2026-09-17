"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import VerifiedBadge from "@/components/VerifiedBadge";

interface SearchCelebrityRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  country: string;
  profession: string;
  accentColor: string;
  isVerified: boolean;
  isFeatured: boolean;
  isActive: boolean;
  hasProfile: boolean;
}

/**
 * Big, app-style "Find anyone to edit" search for the admin celebrities page.
 * Type a name → live results drop down → tap any row to jump straight into that
 * community's editor. Full keyboard support (arrows, Enter, Escape).
 */
export default function AdminCelebritySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchCelebrityRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [error, setError] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/celebrities/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (seq !== seqRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { celebrities: SearchCelebrityRow[] };
      if (seq !== seqRef.current) return;
      setResults(data.celebrities ?? []);
      setHighlight(0);
    } catch {
      if (seq !== seqRef.current) return;
      setError(true);
      setResults([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // Debounced live search. Also seeds the "everyone" list on mount so the very
  // first open already shows results to tap.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => void runSearch(q), 200);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const openEdit = useCallback(
    (c: SearchCelebrityRow) => {
      setOpen(false);
      setQuery("");
      router.push(`/admin/celebrities/${c.id}`);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results[highlight]) {
        e.preventDefault();
        openEdit(results[highlight]);
      }
    }
  };

  const showResults = open && !error && (results.length > 0 || !query.trim()) && !loading;
  const showNoResults = open && !error && query.trim().length > 0 && results.length === 0 && !loading;

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-3xl">
      <div className="group relative">
        <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary-400">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Find anyone to edit — search by name…"
          aria-label="Search celebrities"
          className="h-16 w-full rounded-2xl border border-white/10 bg-ink-800/90 pl-[3.75rem] pr-14 text-lg font-semibold text-white shadow-2xl shadow-black/40 outline-none transition placeholder:font-normal placeholder:text-zinc-500 focus:border-primary-500/70 focus:ring-4 focus:ring-primary-500/20"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Tap to edit
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-x-0 top-full z-30 mt-2">
          <div className="mx-auto mt-2 w-fit rounded-full bg-ink-800/90 px-4 py-2 text-sm text-zinc-400 shadow-xl ring-1 ring-white/10">
            Searching…
          </div>
        </div>
      )}

      {showResults && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <p className="border-b border-white/5 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {query.trim() ? "Matches" : "All communities — pick anyone"}
          </p>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {results.map((c, i) => (
              <li key={c.id} className="px-1">
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => openEdit(c)}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition ${
                    i === highlight ? "bg-primary-500/15" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-900 p-1">
                    {c.hasProfile ? (
                      <Image
                        src={`/images/${c.slug}/profile`}
                        alt=""
                        width={48}
                        height={60}
                        className="h-full w-full rounded-md object-cover object-top"
                      />
                    ) : (
                      <div
                        className="grid h-full w-full place-items-center rounded-md text-sm font-bold text-white"
                        style={{ backgroundColor: c.accentColor }}
                      >
                        {c.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-white">
                        {c.name}
                        {c.isVerified && <VerifiedBadge className="ml-1 inline h-4 w-4" />}
                      </p>
                      {c.isFeatured && (
                        <span className="rounded-full bg-gold-500/15 px-1.5 py-0.5 text-[10px] font-bold text-gold-400">
                          ★
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {[c.profession, c.country, c.category].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      c.isActive
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-zinc-600/20 text-zinc-400"
                    }`}
                  >
                    {c.isActive ? "Active" : "Hidden"}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition group-hover:bg-primary-500">
                    Edit →
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/5 px-5 py-2.5 text-[11px] text-zinc-500">
            ↑↓ navigate · Enter to open · tap any row to edit that profile
          </div>
        </div>
      )}

      {showNoResults && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-white/10 bg-ink-800/95 p-6 text-center shadow-2xl shadow-black/60">
          <p className="text-sm font-semibold text-zinc-300">
            No one named “{query.trim()}” is here yet.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Try another spelling — or add them with the “+ New Celebrity” button.
          </p>
        </div>
      )}
    </div>
  );
}