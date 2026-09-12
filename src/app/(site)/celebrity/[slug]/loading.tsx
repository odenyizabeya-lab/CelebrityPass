export default function CelebrityDetailLoading() {
  return (
    <div role="status" aria-live="polite">
      {/* Cover skeleton */}
      <div className="h-64 w-full animate-pulse bg-white/[0.04] sm:h-80" />
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative z-10 -mt-24 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="w-[320px] max-w-full shrink-0 sm:w-[450px] lg:w-[560px]">
            <div className="grid aspect-[4/5] w-full place-items-center rounded-3xl bg-ink-900 p-2 shadow-2xl ring-4 ring-ink-900">
              <div className="h-full w-full animate-pulse rounded-2xl bg-white/[0.06]" />
            </div>
          </div>
          <div className="flex-1 space-y-3 pb-1">
            <div className="h-8 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-6 w-1/3 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}