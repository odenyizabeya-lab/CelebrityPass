export default function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded-full bg-white/10" />
          <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-9 w-16 animate-pulse rounded-full bg-white/10" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 animate-pulse"
          >
            <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-2/5 rounded bg-white/10" />
              <div className="h-3 w-3/5 rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}