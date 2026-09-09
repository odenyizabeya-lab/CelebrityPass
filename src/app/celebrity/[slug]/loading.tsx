export default function CelebrityLoading() {
  return (
    <div aria-label="Loading community" className="animate-pulse">
      <div className="h-52 w-full sm:h-72" style={{ background: "linear-gradient(115deg, rgba(139,92,246,0.35), rgba(39,16,74,0.6) 45%, #0b0c10)" }} />
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="-mt-20 flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="w-32 shrink-0 sm:w-40">
            <div className="aspect-[4/5] rounded-2xl bg-white/[0.08] p-1.5 shadow-2xl ring-4 ring-ink-900">
              <div className="h-full w-full rounded-xl bg-white/[0.06]" />
            </div>
          </div>
          <div className="flex-1 space-y-3 pb-1">
            <div className="h-8 w-64 max-w-full rounded-lg bg-white/[0.08]" />
            <div className="h-6 w-48 max-w-full rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-72 max-w-full rounded-lg bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}