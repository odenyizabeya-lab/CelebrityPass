"use client";

import { useEffect, useState } from "react";

const KEY = "cp:invest:watchlist";

function readList(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
  } catch {
    /* ignore corrupt storage */
  }
  return [];
}

function writeList(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable — safe to ignore */
  }
}

/**
 * Locally persisted watchlist of ticker symbols. Lives on the device only and
 * does not touch the backend — instant, native "star" feel on every screen.
 */
export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);

  // Hydration-safe load: start empty, then read the locally stored list after
  // mount (deferred off the synchronous effect body).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = requestAnimationFrame(() => setSymbols(readList()));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle(symbol: string) {
    const next = symbols.includes(symbol)
      ? symbols.filter((s) => s !== symbol)
      : [...symbols, symbol];
    setSymbols(next);
    writeList(next);
  }

  return { symbols, toggle };
}

/** Star toggle button used on market rows / ticker header. */
export function WatchStar({ symbol, on }: { symbol: string; on?: boolean }) {
  return (
    <span className={on ? "text-amber-400" : "text-zinc-600"}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} role="img" aria-label={`Watch ${symbol}`}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.5 3.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
        />
      </svg>
    </span>
  );
}