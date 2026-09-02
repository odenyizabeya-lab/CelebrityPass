"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("search", q.trim());
    if (category) params.set("category", category);
    router.push(`/celebrities?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-xl sm:flex-row sm:items-center sm:rounded-full"
    >
      <div className="flex flex-1 items-center gap-3 px-3">
        <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a celebrity, artist, athlete…"
          className="w-full bg-transparent py-2 text-sm text-white placeholder-zinc-500 outline-none"
        />
      </div>
      <div className="flex items-center gap-2 sm:gap-1">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-full border border-white/10 bg-ink-800 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-primary-500"
        >
          <option value="">All Categories</option>
          <option>Musician</option>
          <option>Athlete</option>
          <option>Actor</option>
          <option>Artist</option>
          <option>Creator</option>
          <option>Public Figure</option>
        </select>
        <button type="submit" className="btn-grad rounded-full px-5 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>
    </form>
  );
}