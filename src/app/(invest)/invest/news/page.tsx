import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { CompanyTile, Chevron, SectionTitle } from "@/components/invest-app/native";

export const dynamic = "force-dynamic";

export const description = "Market news and official company resources";

export default async function NewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">News</p>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">Market news</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
          Headlines are sourced from the official exchange listings of each company and are not generated or rewritten by
          CelebrityPass.
        </p>
      </div>

      <section className="fade-up">
        <SectionTitle>Official company resources</SectionTitle>
        <div className="mt-3 space-y-2.5">
          {COMPANY_CATALOG.map((c) => (
            <a
              key={c.symbol}
              href={c.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-4 py-4 ring-1 ring-white/[0.08] transition active:bg-white/[0.04]"
            >
              <CompanyTile symbol={c.mono} accent={c.accent} />
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block text-[15px] leading-snug font-bold text-white">{c.name}</span>
                <span className="mt-1 block text-[12px] leading-snug text-zinc-500">{c.symbol} · {c.exchange}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-sky-400 ring-1 ring-white/[0.08]">
                Official news
              </span>
              <Chevron />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}