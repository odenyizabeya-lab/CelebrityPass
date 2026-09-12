export default function GlobalLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-primary-400" />
        <span className="text-sm text-zinc-500">Loading…</span>
      </div>
    </div>
  );
}