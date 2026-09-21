import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
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

/** The real Bitcoin (₿ Core) brand mark — recognizable at any size. */
function BtcMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="#fff" aria-hidden>
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.15-1.32-.33-.525 2.107c-.347-.087-.702-.17-1.055-.25l.526-2.11-1.32-.33-.54 2.15c-.286-.065-.567-.128-.84-.197l-1.815-.45-.35 1.407s.975.225.955.236c.53.136.63.49.613.77l-1.57 6.322c-.065.16-.24.4-.57.31.015.022-.955-.24-.955-.24l-.65 1.514 1.71.425c.318.08.63.157.935.233l-.546 2.192 1.32.33.54-2.158c.36.098.71.188 1.05.27l-.535 2.148 1.32.33.545-2.19c2.24.425 3.925.25 4.635-1.77.57-1.62-.03-2.55-1.217-3.16.865-.2 1.517-.77 1.69-1.94zm-3.03 4.245c-.406 1.628-3.15.75-4.04.53l.72-2.9c.892.23 3.757.68 3.32 2.37zm.41-4.253c-.37 1.49-2.662.733-3.405.55l.656-2.637c.743.186 3.137.53 2.75 2.087z" />
    </svg>
  );
}

/** Ethereum (Ξ) mark. */
function EthMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[56%] w-[56%]" fill="#fff" aria-hidden>
      <path d="M12 2l1.2 1.9L12 .9l-1.2 3zm0 21L3.6 12.9 12 17.5l8.4-4.6L12 23z" />
      <path d="M12 2v10.2l8.8-3.4L12 2zM12 23V12l8.8-5.4L12 23z" opacity="0.7" />
    </svg>
  );
}

/** Solana — the three slanted parallel bars. */
function SolMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[54%] w-[54%]" fill="#fff" aria-hidden>
      <path d="M8.2 6.2h10.4L14.2 4l-6 .2 0 0a.4.4 0 0 0 0 0z" />
      <path d="M6 9.2l1.6-1.2 4.4.2c.8.6 3.4 2.3 4.6 3.1l.4.2h6.2l-2.4-1.6H17l-2.8-1.9c-1.3-.9-2.8-1.7-3-2H9.4L6 9.2z" opacity="0.95" />
      <path d="M7.8 14.6l6.6-.4 2.6-1.8H5.2l2.6 2.2z" opacity="0.9" />
      <path d="M5.8 16.9l1.2-.7 7.2.2 2.4-1.6H4.4l1.4 2.1z" opacity="0.8" />
    </svg>
  );
}

/** XRP — the two crossed slanted strokes. */
function XrpMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[54%] w-[54%]" fill="#fff" aria-hidden>
      <path d="M6 4.6h3.2L12 8.2l2.8-3.6H18L12 11.6 6 4.6zM6 19.4h3.2L12 15.8l2.8 3.6H18l-6-7-6 7z" />
    </svg>
  );
}

/** BNB — the four-part diamond. */
function BnbMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[54%] w-[54%]" aria-hidden>
      <path
        d="M12 2.4L21.6 12 12 21.6 2.4 12 12 2.4zm0 3.4L5.8 12 12 18.2 18.2 12 12 5.8zM12 3.5L8.4 7.1 12 10.7l3.6-3.6L12 3.5zm0 9.8l-3.6-3.6L12 6.2l3.6 3.5L12 13.3z"
        fill="#fff"
      />
    </svg>
  );
}

export const CRYPTO_MARKS: Record<string, () => ReactElement> = {
  BTC: BtcMark,
  ETH: EthMark,
  SOL: SolMark,
  XRP: XrpMark,
  BNB: BnbMark,
};

/**
 * Recognizable asset logo tile. Cryptos get their own authentic brand mark
 * (Bitcoin ₿, Ethereum Ξ, Solana bars, XRP strokes, BNB diamond); equities,
 * ETFs, commodities and indices keep the ticker in a colored tile. The glyph
 * is always vertically + horizontally centered inside a fixed-size square so
 * rows never clip or stretch it.
 */
export function AssetLogo({
  ticker,
  accent,
  className = "h-12 w-12 rounded-2xl text-[11px]",
}: {
  ticker: string;
  accent: string;
  className?: string;
}) {
  const up = ticker.toUpperCase();
  const Mark = CRYPTO_MARKS[up];
  if (Mark) {
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden shadow-lg ${className}`}
        style={{ background: accent }}
        role="img"
        aria-label={`${up} logo`}
      >
        <Mark />
      </span>
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center font-black text-white shadow-lg ${className}`}
      style={{ background: accent }}
    >
      <span className={up.length > 5 ? "text-[0.58em]" : up.length > 4 ? "text-[0.68em]" : up.length > 3 ? "text-[0.82em]" : "text-[1.05em]"}>
        {up}
      </span>
    </span>
  );
}

/** Company logo tile. */
export function CompanyTile({
  symbol,
  ticker,
  accent,
  className = "h-12 w-12 rounded-2xl text-[11px]",
}: {
  /** Display text used when no brand mark exists (ticker letters). */
  symbol: string;
  /** The canonical ticker used to look up a brand mark (e.g. "BTC"). */
  ticker?: string;
  accent: string;
  className?: string;
}) {
  return <AssetLogo ticker={ticker ?? symbol} accent={accent} className={className} />;
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