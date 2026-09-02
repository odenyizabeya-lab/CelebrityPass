"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Props = {
  categories: string[];
  countries: string[];
  professions: string[];
};

export default function DirectoryFilters({ categories, countries, professions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const country = searchParams.get("country") ?? "";
  const profession = searchParams.get("profession") ?? "";

  const apply = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { search, category, country, profession, ...patch };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/celebrities?${qs}` : "/celebrities");
    });
  };

  const selectCls =
    "rounded-full border border-white/10 bg-ink-800 px-3.5 py-2 text-sm text-zinc-300 outline-none focus:border-primary-500";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({ search: String(fd.get("search") ?? "") });
      }}
      className="glass flex flex-col gap-3 rounded-3xl p-4 md:flex-row md:items-center"
    >
      <div className="flex flex-1 items-center gap-3 rounded-full bg-ink-800 px-4">
        <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by celebrity name…"
          className="w-full bg-transparent py-2.5 text-sm text-white placeholder-zinc-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <select value={category} onChange={(e) => apply({ category: e.target.value })} className={selectCls}>
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={country} onChange={(e) => apply({ country: e.target.value })} className={selectCls}>
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={profession} onChange={(e) => apply({ profession: e.target.value })} className={selectCls}>
          <option value="">Profession</option>
          {professions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-grad rounded-full px-5 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>
    </form>
  );
}