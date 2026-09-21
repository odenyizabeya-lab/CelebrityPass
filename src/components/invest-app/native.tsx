import Link from "next/link";
import type { ReactNode } from "react";
import VerifiedBadge from "@/components/VerifiedBadge";

/* ------------------------------------------------------------------ */
/* Native mobile design primitives for the CelebrityPass invest app.   */
/* ------------------------------------------------------------------ */

/** Uppercase eyebrow label (small secondary metadata). */
export function Eye({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ${className}`}>{children}</p>
  );
}

/** Section heading (medium supporting information). */
export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-[18px] font-extrabold tracking-tight text-white ${className}`}>{children}</h2>
  );
}

/** App card: soft gradient surface with a hairline ring — the native look. */
export function NativeCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] ring-1 ring-white/[0.08] ${className}`}
    >
      {children}
    </div>
  );
}

/** Big primary action button (the purple gradient). Supports <a>/<button>. */
export function PrimaryAction({
  href,
  onClick,
  disabled,
  busy,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const cls = `btn-grad flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={cls}>
      {busy ? children : children}
    </button>
  );
}

/** Secondary action button (outlined, native). Supports <a>/<button>. */
export function SecondaryAction({
  href,
  onClick,
  disabled,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const cls = `flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] py-4 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/** Company logo tile. */
export function CompanyTile({
  symbol,
  accent,
  className = "h-12 w-12 rounded-2xl text-[11px]",
}: {
  symbol: string;
  accent: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center font-black text-white shadow-lg ${className}`}
      style={{ background: accent }}
    >
      {symbol}
    </span>
  );
}

/** Company identity line: name + verified badge (+ ticker/exchange underneath). */
export function CompanyIdentity({
  name,
  symbol,
  exchange,
  typeLabel,
  subtitle,
}: {
  name: string;
  symbol: string;
  exchange: string;
  typeLabel?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold text-white">{name}</span>
          <VerifiedBadge className="h-4 w-4 shrink-0" />
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
          {symbol} · {exchange}
          {typeLabel ? ` · ${typeLabel}` : ""}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
    </div>
  );
}

const CHANGE_UP = "text-emerald-400";
const CHANGE_DOWN = "text-rose-400";

/** Formatted price + change pair, right-aligned like native market apps. */
export function PriceChange({
  price,
  changePct,
  change,
  priceClass = "text-[15px]",
}: {
  price: number | null | undefined;
  changePct: number | null | undefined;
  change?: number | null;
  priceClass?: string;
}) {
  const up = (change ?? changePct ?? 0) >= 0;
  return (
    <span className="text-right">
      <span className={`block font-extrabold tracking-tight text-white ${priceClass}`}>
        {price !== null && price !== undefined ? `$${price.toFixed(2)}` : "—"}
      </span>
      {changePct !== null && changePct !== undefined && (
        <span className={`mt-0.5 block text-[12px] font-bold ${up ? CHANGE_UP : CHANGE_DOWN}`}>
          {up ? "▲" : "▼"} {changePct > 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      )}
    </span>
  );
}

/** Change pill (positive=green, negative=red). */
export function ChangePill({
  value,
  suffix = "%",
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  const up = (value ?? 0) >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ${
        up ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" : "bg-rose-500/10 text-rose-400 ring-rose-500/30"
      }`}
    >
      {up ? "▲" : "▼"} {value !== null && value !== undefined ? `${up ? "+" : ""}${value.toFixed(2)}${suffix}` : "—"}
    </span>
  );
}

/** Vertical metric block used in summary cards. */
export function Metric({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 truncate font-black tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

/** Inline list row with right chevron (native settings style). */
export function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}