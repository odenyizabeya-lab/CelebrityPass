// Shared "printed card" building blocks. Used by FanCardView and the card
// graphics on celebrity pages so every card — real fan cards and previews —
// looks like the same physical, professional ID card.

/** Fine-line guilloche background that makes cards feel printed, not painted. */
export function CardGuilloche({ color }: { color: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.10]" aria-hidden>
      <defs>
        <pattern id="cp-guilloche" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M0 17a17 17 0 0 1 34 0M34 17a17 17 0 0 1-34 0" fill="none" stroke={color} strokeWidth="1.1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cp-guilloche)" />
    </svg>
  );
}

/** The two inner printed border rings of a real card. Placed inside a
 *  `relative overflow-hidden` card container. */
export function CardFrame() {
  return (
    <>
      <div className="pointer-events-none absolute inset-[7px] rounded-[15px] ring-1 ring-white/25" />
      <div className="pointer-events-none absolute inset-[11px] rounded-[12px] ring-1 ring-white/10" />
    </>
  );
}

/** Refined card RFID-style chip with circuit lines. */
export function CardChip({ tone }: { tone: "brand" | "gold" }) {
  const line = tone === "gold" ? "#f5d98a" : "#ffffff";
  const soft = tone === "gold" ? "#c9a24c" : "#e9d5ff";
  return (
    <svg viewBox="0 0 56 44" className="h-11 w-14 overflow-hidden rounded-md" aria-hidden>
      <defs>
        <linearGradient id="cp-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={soft} />
          <stop offset="0.55" stopColor={line} />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="54" height="42" rx="6" fill="url(#cp-chip)" opacity="0.92" />
      <rect x="1" y="1" width="54" height="42" rx="6" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      <path d="M0 15h18M0 29h18M38 15h18M38 29h18" stroke="rgba(0,0,0,0.35)" strokeWidth="2" fill="none" />
      <path d="M14 15v4a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3V15M14 29v-4a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v4" stroke="rgba(0,0,0,0.45)" strokeWidth="2" fill="none" />
      <circle cx="28" cy="22" r="7" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
      <path d="M28 15v14M21 22h14" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5" />
    </svg>
  );
}

/** Deterministic pseudo-random barcode bars from a seed string. */
export function CardBarcode({ seed, className = "" }: { seed: string; className?: string }) {
  const bars: number[] = [];
  let h = 0x2f6e2b1;
  for (let i = 0; i < 64; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + 33), 2654435761) >>> 0;
    bars.push((h % 2 === 0 ? 2 : 1) + ((h >>> 8) % 2));
  }
  const gaps = 1;
  const total = bars.reduce((a, w) => a + w, 0) + gaps * (bars.length - 1);
  let x = 0;
  return (
    <svg viewBox={`0 0 ${total} 100`} preserveAspectRatio="none" className={`h-full w-full ${className}`} aria-hidden>
      {bars.map((w, i) => {
        const start = x;
        x += w + gaps;
        return <path key={i} d={`M${start} 0h${w}v100h-${w}z`} fill="currentColor" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

/** The CP tab that sits in the brand corner of every card. */
export function CardBrandTab({ label = "CP" }: { label?: string }) {
  return (
    <div className="grid h-5 w-7 place-items-center rounded bg-white shadow-sm">
      <p className="text-[7px] font-black tracking-tighter text-neutral-800">{label}</p>
    </div>
  );
}