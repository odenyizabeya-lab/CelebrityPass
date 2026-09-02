// Status badge for an event. Visual mapping only — the status value is always
// computed server-side or supplied by the caller (never fabricated here).
export default function EventStatusBadge({
  status,
  className = "",
}: {
  status: string;
  verification?: string | null;
  className?: string;
}) {
  const styles: Record<string, string> = {
    UPCOMING: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    HAPPENING_NOW: "bg-rose-500/20 text-rose-300 ring-rose-400/40 animate-pulse",
    COMPLETED: "bg-zinc-500/15 text-zinc-400 ring-white/10",
    POSTPONED: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    CANCELLED: "bg-zinc-800 text-zinc-500 ring-white/10 line-through",
  };
  const label: Record<string, string> = {
    UPCOMING: "Upcoming",
    HAPPENING_NOW: "Happening Now",
    COMPLETED: "Completed",
    POSTPONED: "Postponed",
    CANCELLED: "Cancelled",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
        styles[status] ?? "bg-zinc-500/15 text-zinc-300 ring-white/10"
      } ${className}`}
    >
      {status === "HAPPENING_NOW" && <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />}
      {label[status] ?? status}
    </span>
  );
}

export function VerificationPill({ verification }: { verification?: string | null }) {
  if (!verification || verification === "UNVERIFIED") return null;
  const map: Record<string, string> = {
    VERIFIED: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    UPDATED: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
    POSTPONED: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    CANCELLED: "bg-zinc-800 text-zinc-500 ring-white/10",
  };
  const label = verification.charAt(0) + verification.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${map[verification] ?? ""}`}>
      {label}
    </span>
  );
}
