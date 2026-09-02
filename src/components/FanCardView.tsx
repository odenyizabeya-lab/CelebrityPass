import Image from "next/image";
import { formatDate, tryParseJson, type CardDesign } from "@/lib/utils";
import VerifiedBadge from "./VerifiedBadge";

export type CardViewData = {
  fanNumber: string;
  status: string;
  registeredAt: string | Date;
  cardUrl: string | null;
  qrCode: string | null;
  fanName: string;
  fanCountry: string | null;
  membershipName: string | null;
  celebrity: {
    name: string;
    slug: string;
    accentColor: string;
    cardDesign: string | null;
    profileImage: string | null;
    coverImage: string | null;
  };
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  SUSPENDED: { label: "Suspended", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
  EXPIRED: { label: "Expired", cls: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30" },
};

/** Renders an official fan membership card for the given card data. */
export default function FanCardView({ card }: { card: CardViewData }) {
  const design = tryParseJson<CardDesign>(card.celebrity.cardDesign, {
    primary: card.celebrity.accentColor,
  });
  const primary = design.primary || card.celebrity.accentColor;
  const accent = design.accent || "#f59e0b";
  const gradientFrom = primary;
  const gradientTo = "#0b0c10";
  const status = STATUS_BADGE[card.status] ?? { label: card.status, cls: "bg-zinc-500/15 text-zinc-300" };

  return (
    <div className="w-full max-w-2xl">
      <div
        className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/15"
        style={{ background: `linear-gradient(125deg, ${gradientFrom} 0%, #27104a 46%, ${gradientTo} 100%)` }}
      >
        {/* Holographic shine */}
        <div className="pointer-events-none absolute -inset-x-10 -top-24 h-48 rotate-6 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Watermark */}
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.05]"
          aria-hidden
        >
          <span className="text-6xl font-black tracking-widest" style={{ color: "#fff" }}>
            {card.celebrity.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
          </span>
        </div>

        <div className="relative p-6 sm:p-8">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl ring-2 ring-white/40">
                {card.celebrity.profileImage ? (
                  <Image
                    src={card.celebrity.profileImage}
                    alt={card.celebrity.name}
                    width={60}
                    height={75}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center text-sm font-black text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {card.celebrity.name[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Official Fan Membership
                </p>
                <p className="flex items-center gap-1 text-lg font-black leading-tight text-white">
                  {card.celebrity.name}
                  <VerifiedBadge className="h-4 w-4" />
                </p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status.cls}`}>
              ● {status.label}
            </span>
          </div>

          {/* Celebrity cover strip */}
          <div className="mt-4 h-20 overflow-hidden rounded-xl ring-1 ring-white/15">
            {card.celebrity.coverImage ? (
              <Image
                src={card.celebrity.coverImage}
                alt=""
                fill
                sizes="(max-width: 672px) 90vw, 608px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div style={{ background: `linear-gradient(100deg, ${accent}, transparent)` }} className="h-full w-full" />
            )}
          </div>

          {/* Middle: member identity + QR */}
          <div className="mt-5 flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Card Holder</p>
              <p className="truncate text-xl font-black tracking-tight text-white">{card.fanName}</p>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                <span className="font-medium text-white/70">Fan ID</span>
                <span className="font-mono font-bold tracking-wide text-white">{card.fanNumber}</span>
                <span className="font-medium text-white/70">Membership</span>
                <span className="font-semibold text-white">{card.membershipName ?? "Standard"}</span>
                <span className="font-medium text-white/70">Country</span>
                <span className="font-semibold text-white">{card.fanCountry ?? "—"}</span>
                <span className="font-medium text-white/70">Issued</span>
                <span className="font-semibold text-white">{formatDate(card.registeredAt)}</span>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-lg">
              {card.qrCode ? (
                <Image
                  src={card.qrCode}
                  alt={`QR code for ${card.fanNumber}`}
                  width={104}
                  height={104}
                  className="h-24 w-24 sm:h-24 sm:w-24"
                  unoptimized
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center text-center text-[10px] font-semibold text-ink-600">
                  Verified
                  <br />
                  Member
                </div>
              )}
            </div>
          </div>

          {/* Bottom: chip + card url + badge */}
          <div className="mt-6 flex items-end justify-between border-t border-white/15 pt-4">
            <div>
              <div className="flex gap-1.5">
                <span className="h-7 w-9 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600" />
                <span className="h-7 w-9 rounded-md bg-gradient-to-br from-white/30 to-white/5 ring-1 ring-white/20" />
              </div>
              <p className="mt-2 text-[11px] text-white/55">{card.cardUrl ?? "/celebrity/" + card.celebrity.slug}</p>
            </div>
            <div className="text-right">
              <p
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {design.badgeText ?? "FAN CARD"}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/50">
                {design.watermark ?? "Official Fan Member"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}