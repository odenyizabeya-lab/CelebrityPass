export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="glass animate-pulse rounded-3xl p-6 sm:p-8">
        <div className="h-4 w-1/3 rounded bg-white/[0.06]" />
        <div className="mt-6 h-3 w-full rounded bg-white/[0.06]" />
        <div className="mt-3 h-3 w-5/6 rounded bg-white/[0.06]" />
        <div className="mt-3 h-3 w-2/3 rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}