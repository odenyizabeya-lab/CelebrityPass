// Shown only for the brief instant the /chat route streams before the client
// hydration applies the local cache. Messages render from localStorage the
// moment the page is interactive, so this stays a static shell — never the old
// multi-card skeleton that sat on screen while the server query finished.
export default function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-white/10" />
          <div className="h-5 w-24 rounded bg-white/10" />
        </div>
        <div className="h-9 w-16 rounded-full bg-white/10" />
      </header>
      <div className="grid min-h-0 flex-1 place-items-center px-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-primary-500" />
          Loading messages…
        </div>
      </div>
    </div>
  );
}