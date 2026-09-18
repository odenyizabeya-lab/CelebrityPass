import Link from "next/link";
import { COMPANY_CATALOG } from "@/lib/invest/companies";

export const dynamic = "force-dynamic";

export const description = "Market news and official company resources";

export default async function NewsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">News</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Headlines are sourced from the official exchange listings of each company and are not generated or rewritten by
          CelebrityPass.
        </p>
      </div>

      <div className="space-y-2.5">
        {COMPANY_CATALOG.map((c) => (
          <a
            key={c.symbol}
            href={c.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#0a0d13] px-4 py-3.5 ring-1 ring-white/[0.07] transition hover:bg-white/[0.03]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white" style={{ background: c.accent }}>
              {c.symbol}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-white">{c.name}</span>
              <span className="block text-[11px] text-zinc-500">{c.symbol} · {c.exchange}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-bold text-sky-400 ring-1 ring-white/[0.08]">
              Official news ›
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}