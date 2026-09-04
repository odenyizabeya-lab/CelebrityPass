"use client";

import { useState } from "react";

type SearchResult = {
  id?: string;
  externalId?: string | null;
  sourceProvider: string;
  sourceLabel: string;
  name: string;
  type: string;
  description?: string | null;
  venue?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  startAt: string;
  endAt?: string | null;
  timezone?: string | null;
  officialUrl?: string | null;
  ticketUrl?: string | null;
  sourceUrl?: string | null;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
  providersSearched: string[];
  providersWithResults: string[];
  totalResults: number;
  searchedAt: string;
};

export default function EventDiscoverySearch() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (country.trim()) params.set("country", country.trim());
      if (city.trim()) params.set("city", city.trim());
      const res = await fetch(`/api/events/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setCountry("");
    setCity("");
    setData(null);
    setSearched(false);
    setError(null);
  }

  return (
    <div>
      <form onSubmit={search} className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a celebrity, artist, or event: BTS, Taylor Swift, Beyoncé…"
            className="flex-1 rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
          />
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country (optional)"
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500 sm:w-40"
          />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (optional)"
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500 sm:w-40"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-grad rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        {searched && (
          <button onClick={clear} className="mt-3 text-xs font-semibold text-zinc-400 hover:text-white">
            Clear search
          </button>
        )}
      </form>

      {error && (
        <div className="mt-6 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</div>
      )}

      {data && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Results for “{data.query}”</h2>
              <p className="mt-1 text-sm text-zinc-400">{data.totalResults} event(s) found</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.providersWithResults.length > 0 ? (
                data.providersWithResults.map((p) => (
                  <span key={p} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    {p}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 ring-1 ring-white/10">
                  No provider returned results
                </span>
              )}
            </div>
          </div>

          {data.providersSearched.length > 0 && (
            <p className="mt-1 text-[11px] text-zinc-600">
              Searched providers: {data.providersSearched.join(", ")}
            </p>
          )}

          {data.results.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-400">
                No events found for “{data.query}”. Try a different celebrity or artist name, or remove filters.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-zinc-600">
                CelebrityPass only shows real, publicly announced events from connected sources — we never fabricate
                celebrity or event data.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.results.map((ev, i) => (
                <div key={i} className="glass rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-white">{ev.name}</p>
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-white/10">
                      {ev.sourceProvider}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{ev.type}</p>

                  <div className="mt-3 space-y-1 text-xs text-zinc-400">
                    {ev.startAt && (
                      <p>
                        <span className="font-semibold text-zinc-300">Date:</span>{" "}
                        {new Date(ev.startAt).toLocaleString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {ev.venue && (
                      <p>
                        <span className="font-semibold text-zinc-300">Venue:</span> {ev.venue}
                      </p>
                    )}
                    {ev.city && (
                      <p>
                        <span className="font-semibold text-zinc-300">City:</span> {ev.city}
                        {ev.region ? `, ${ev.region}` : ""}
                      </p>
                    )}
                    {ev.country && (
                      <p>
                        <span className="font-semibold text-zinc-300">Country:</span> {ev.country}
                      </p>
                    )}
                    {ev.description && <p className="line-clamp-2 text-zinc-500">{ev.description}</p>}
                  </div>

                  {(ev.ticketUrl || ev.officialUrl) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {ev.ticketUrl && (
                        <a
                          href={ev.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-grad rounded-full px-4 py-2 text-xs font-bold text-white"
                        >
                          View Tickets
                        </a>
                      )}
                      {ev.officialUrl && ev.officialUrl !== ev.ticketUrl && (
                        <a
                          href={ev.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
                        >
                          Official link
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-sm font-black text-white">How this works</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            CelebrityPass searches <span className="text-zinc-200">every connected event provider</span> for the
            celebrity or artist you enter, merges the legitimate results, and removes duplicates. We only show real,
            publicly announced events from sources that authorize the use — we never invent concerts, tickets, prices,
            or celebrity appearances.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            When you tap “View Tickets”, you are taken to the official ticket provider for that event. CelebrityPass
            does not sell tickets itself unless it holds authorized inventory.
          </p>
        </div>
      )}
    </div>
  );
}
