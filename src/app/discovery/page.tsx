import type { Metadata } from "next";
import EventDiscoverySearch from "@/components/EventDiscoverySearch";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event Discovery — CelebrityPass",
  description:
    "Search real concerts and events across multiple verified providers. CelebrityPass only shows publicly announced events — no fake listings.",
};

export default async function EventDiscoveryPage() {
  const enabledSources = await prisma.eventSource.findMany({
    where: { enabled: true, key: { not: "admin" } },
    select: { key: true, name: true, lastSyncStatus: true, lastSyncAt: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Multi-Source Discovery</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Event Discovery</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          Search real concerts and events for any celebrity or artist, across all connected providers. Results are
          deduplicated and never fabricated.
        </p>
      </div>

      <EventDiscoverySearch />

      {enabledSources.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Connected event sources</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {enabledSources.map((s) => (
              <span
                key={s.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  s.lastSyncStatus === "error"
                    ? "bg-rose-500/10 text-rose-300 ring-rose-400/30"
                    : s.lastSyncStatus === "ok"
                      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30"
                      : "bg-white/5 text-zinc-400 ring-white/10"
                }`}
              >
                {s.name}
                {s.lastSyncStatus ? ` · ${s.lastSyncStatus}` : " · never synced"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
