// Distinct full-card colour palettes for every membership tier.
// Each tier gets its own gradient so fans instantly tell cards apart.
// Selecting a tier swaps it to PAYMENT_PALETTE (the unified "ready to pay"
// green) so the chosen card is visually distinct from every unselected one.
// Gradient start colours are kept mid-to-dark so white text stays readable.

export type TierPalette = {
  /** Full-card gradient background. */
  bg: string;
  /** Light accent for prices, badges and small text on the card. */
  accent: string;
  /** Solid/gradient button fill. */
  button: string;
  /** Text colour on the button. */
  buttonText: string;
  /** Short marketing line for base tiers (experiences use their DB tagline). */
  blurb?: string;
};

/** Unified colour shown on the SELECTED card — the "proceed to payment" state. */
export const PAYMENT_PALETTE: TierPalette = {
  bg: "linear-gradient(140deg,#10b981 0%,#059669 50%,#065f46 100%)",
  accent: "#d1fae5",
  button: "#ffffff",
  buttonText: "#065f46",
};

const SILVER: TierPalette = {
  bg: "linear-gradient(140deg,#64748b 0%,#475569 50%,#1e293b 100%)",
  accent: "#e2e8f0",
  button: "#cbd5e1",
  buttonText: "#0f172a",
  blurb: "Official entry-level fan card with your own verified Fan ID.",
};

const GOLD: TierPalette = {
  bg: "linear-gradient(140deg,#b45309 0%,#92400e 50%,#451a03 100%)",
  accent: "#fde68a",
  button: "#f59e0b",
  buttonText: "#451a03",
  blurb: "Gold status card with an eye-catching design and priority community news.",
};

const PLATINUM: TierPalette = {
  bg: "linear-gradient(140deg,#155e75 0%,#164e63 50%,#020617 100%)",
  accent: "#a5f3fc",
  button: "#22d3ee",
  buttonText: "#083344",
  blurb: "Platinum status card for dedicated, long-time supporters.",
};

const PREMIUM: TierPalette = {
  bg: "linear-gradient(140deg,#7c3aed 0%,#5b21b6 50%,#2e1065 100%)",
  accent: "#ddd6fe",
  button: "#a78bfa",
  buttonText: "#2e1065",
  blurb: "Premium membership with exclusive content and full community access.",
};

const VIP: TierPalette = {
  bg: "linear-gradient(140deg,#e11d48 0%,#be123c 50%,#4c0519 100%)",
  accent: "#fecdd3",
  button: "#fb7185",
  buttonText: "#4c0519",
  blurb: "Top-tier VIP card with premium recognition and early access to events.",
};

const RED_CARPET: TierPalette = {
  bg: "linear-gradient(140deg,#b91c1c 0%,#991b1b 50%,#450a0a 100%)",
  accent: "#fecaca",
  button: "#f87171",
  buttonText: "#450a0a",
};

const BACKSTAGE: TierPalette = {
  bg: "linear-gradient(140deg,#7e22ce 0%,#6b21a8 50%,#3b0764 100%)",
  accent: "#e9d5ff",
  button: "#c084fc",
  buttonText: "#3b0764",
};

const ENCORE: TierPalette = {
  bg: "linear-gradient(140deg,#be185d 0%,#9d174d 50%,#500724 100%)",
  accent: "#fbcfe8",
  button: "#f472b6",
  buttonText: "#500724",
};

const SPOTLIGHT: TierPalette = {
  bg: "linear-gradient(140deg,#c2410c 0%,#9a3412 50%,#431407 100%)",
  accent: "#fed7aa",
  button: "#fb923c",
  buttonText: "#431407",
};

const GOLDEN_HOUR: TierPalette = {
  bg: "linear-gradient(140deg,#a16207 0%,#854d0e 50%,#422006 100%)",
  accent: "#fef08a",
  button: "#facc15",
  buttonText: "#422006",
};

const FRONT_ROW: TierPalette = {
  bg: "linear-gradient(140deg,#0f766e 0%,#115e59 50%,#042f2e 100%)",
  accent: "#99f6e4",
  button: "#2dd4bf",
  buttonText: "#042f2e",
};

const PLATINUM_SHOW: TierPalette = {
  bg: "linear-gradient(140deg,#075985 0%,#0c4a6e 50%,#082f49 100%)",
  accent: "#bae6fd",
  button: "#38bdf8",
  buttonText: "#082f49",
};

const HEADLINE: TierPalette = {
  bg: "linear-gradient(140deg,#1d4ed8 0%,#1e40af 50%,#172554 100%)",
  accent: "#bfdbfe",
  button: "#60a5fa",
  buttonText: "#172554",
};

const DIAMOND_GALA: TierPalette = {
  bg: "linear-gradient(140deg,#4f46e5 0%,#4338ca 50%,#1e1b4b 100%)",
  accent: "#c7d2fe",
  button: "#818cf8",
  buttonText: "#1e1b4b",
};

const DIAMOND_CROWN: TierPalette = {
  bg: "linear-gradient(140deg,#6d28d9 0%,#4c1d95 50%,#0c0a1a 100%)",
  accent: "#e9d5ff",
  button: "#a78bfa",
  buttonText: "#0c0a1a",
};

const SOVEREIGN: TierPalette = {
  bg: "linear-gradient(140deg,#c026d3 0%,#a21caf 50%,#4a044e 100%)",
  accent: "#f5d0fe",
  button: "#e879f9",
  buttonText: "#4a044e",
};

const IMMORTAL: TierPalette = {
  bg: "linear-gradient(140deg,#065f46 0%,#064e3b 50%,#021a13 100%)",
  accent: "#6ee7b7",
  button: "#34d399",
  buttonText: "#021a13",
};

const STAGE_ROYAL: TierPalette = {
  bg: "linear-gradient(140deg,#4d7c0f 0%,#365314 50%,#1a2e05 100%)",
  accent: "#d9f99d",
  button: "#a3e635",
  buttonText: "#1a2e05",
};

const LEGEND: TierPalette = {
  bg: "linear-gradient(140deg,#292524 0%,#1c1917 50%,#0c0a09 100%)",
  accent: "#fde68a",
  button: "linear-gradient(135deg,#fbbf24,#b45309)",
  buttonText: "#451a03",
};

const ETERNAL: TierPalette = {
  bg: "linear-gradient(120deg,#9f1239 0%,#9a3412 28%,#166534 52%,#1e3a8a 76%,#581c87 100%)",
  accent: "#ffffff",
  button: "#ffffff",
  buttonText: "#111827",
};

/** Lookup by tier name (case-insensitive); unknown names fall back by index. */
const BY_NAME: Record<string, TierPalette> = {
  silver: SILVER,
  gold: GOLD,
  platinum: PLATINUM,
  premium: PREMIUM,
  vip: VIP,
  "red carpet": RED_CARPET,
  backstage: BACKSTAGE,
  encore: ENCORE,
  spotlight: SPOTLIGHT,
  "golden hour": GOLDEN_HOUR,
  "front row": FRONT_ROW,
  "platinum show": PLATINUM_SHOW,
  headline: HEADLINE,
  "diamond gala": DIAMOND_GALA,
  "diamond crown": DIAMOND_CROWN,
  "sovereign experience": SOVEREIGN,
  "the immortal": IMMORTAL,
  "stage royal": STAGE_ROYAL,
  "the legend": LEGEND,
  "the eternal": ETERNAL,
};

const FALLBACK: TierPalette[] = [
  SILVER, GOLD, PLATINUM, PREMIUM, VIP,
  RED_CARPET, BACKSTAGE, ENCORE, SPOTLIGHT, GOLDEN_HOUR,
  FRONT_ROW, PLATINUM_SHOW, HEADLINE, DIAMOND_GALA, DIAMOND_CROWN,
  SOVEREIGN, IMMORTAL, STAGE_ROYAL, LEGEND, ETERNAL,
];

/** Palette for one membership tier — matched by name first, else by index. */
export function tierPalette(name?: string | null, index = 0): TierPalette {
  const key = (name ?? "").trim().toLowerCase();
  const hit = BY_NAME[key];
  if (hit) return hit;
  const list = FALLBACK;
  return list[Math.abs(index) % list.length];
}
