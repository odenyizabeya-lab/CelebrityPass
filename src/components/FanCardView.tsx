import Image from "next/image";
import { formatDate, tryParseJson, type CardDesign } from "@/lib/utils";
import T from "./T";
import VerifiedBadge from "./VerifiedBadge";
import { CardBarcode, CardBrandTab, CardChip, CardFrame, CardGuilloche } from "./card-bits";

export type CardViewData = {
  fanNumber: string;
  status: string;
  registeredAt: string | Date;
  cardUrl: string | null;
  qrCode: string | null;
  fanName: string;
  fanCountry: string | null;
  membershipName: string | null;
  membershipPrice: number | null;
  celebrity: {
    name: string;
    slug: string;
    accentColor: string;
    cardDesign: string | null;
    profileImage: string | null;
    coverImage: string | null;
    isVerified: boolean;
  };
};

const STATUS_BADGE: Record<string, { key: string; cls: string }> = {
  ACTIVE: { key: "fanCard.statusActive", cls: "bg-emerald-100/90 text-emerald-900" },
  SUSPENDED: { key: "fanCard.statusSuspended", cls: "bg-rose-100/90 text-rose-900" },
  EXPIRED: { key: "fanCard.statusExpired", cls: "bg-zinc-200/90 text-zinc-800" },
};

// Cards at or above this price render in the premium black-gold "ELITE" skin.
const PREMIUM_MIN_PRICE = 2500;

/** Renders an official, realistic membership ID card (front face only). */
export default function FanCardView({ card }: { card: CardViewData }) {
  const design = tryParseJson<CardDesign>(card.celebrity.cardDesign, {
    primary: card.celebrity.accentColor,
  });
  const premium = (card.membershipPrice ?? 0) >= PREMIUM_MIN_PRICE;
  const primary = design.primary || card.celebrity.accentColor;
  const status = STATUS_BADGE[card.status] ?? { key: null, cls: "bg-zinc-200/90 text-zinc-800" };
  const initials = card.celebrity.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  const classLabel = premium ? "ELITE" : card.membershipName ?? "STANDARD";
  const brandAccent = premium ? "#f0c75e" : "#ffffff";
  const fail = "FFFFFFFF";

  return (
    <div className="flex w-full flex-col items-center">
      {/* Camera-height finish: the card floats with a soft platform shadow like a
          native app ID preview. */}
      <div className="w-full max-w-[560px]">
        <div
          className="relative w-full select-none overflow-hidden rounded-[22px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85),0_8px_24px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
          style={{ aspectRatio: "85.6 / 54", background: premium ? "linear-gradient(135deg,#171310 0%,#3b2b12 42%,#0c0a07 100%)" : `linear-gradient(135deg,${primary} 0%,#241a4d 52%,#0a0b12 100%)` }}
        >
          {/* Printed look: guilloche + edge lighting + hologram sheen */}
          <CardGuilloche color={premium ? "#f0c75e" : brandAccent} />
          <div className="pointer-events-none absolute -inset-x-8 -top-24 h-48 rotate-6 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
          {premium && (
            <div className="pointer-events-none absolute -left-12 top-1/4 h-44 w-36 rotate-[24deg] bg-gradient-to-r from-transparent via-amber-200/[0.12] to-transparent" />
          )}

          {/* Inner printed frame (double-line border like a government ID) */}
          <CardFrame />

          <div className="relative flex h-full flex-col p-[6%]">
            {/* ===== Header band ===== */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardBrandTab />
                <div className="leading-none">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: brandAccent }}>
                    Celebrity<span className="opacity-80">Pass</span>
                  </p>
                  <p className="mt-0.5 text-[6.5px] font-bold uppercase tracking-[0.28em] text-white/60">
                    Official Membership Card
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {card.celebrity.isVerified && (
                  <VerifiedBadge className="h-3.5 w-3.5" />
                )}
                <span className={`rounded-full px-2 py-0.5 text-[7.5px] font-black uppercase tracking-[0.12em] ${status.cls}`}>
                  {status.key ? <T k={status.key} /> : card.status}
                </span>
              </div>
            </div>

            {/* ===== Body: photo + ID details ===== */}
            <div className="mt-[6%] flex min-h-0 flex-1 items-stretch gap-[4.5%]">
              {/* Photo panel (mounted like a license photo) */}
              <div className="relative w-[24%] shrink-0 overflow-hidden rounded-[10px] bg-white/90 p-[2.5%] shadow-inner">
                <div className="relative h-full w-full overflow-hidden bg-neutral-200">
                  {card.celebrity.profileImage ? (
                    <Image
                      src={`/images/${card.celebrity.slug}/profile`}
                      alt={card.celebrity.name}
                      width={120}
                      height={150}
                      sizes="120px"
                      unoptimized
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div
                      className="grid h-full w-full place-items-center text-lg font-black text-white"
                      style={{ backgroundColor: primary }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
                <p className="absolute inset-x-0 bottom-0 bg-white/70 py-[3%] text-center text-[5.5px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                  Fan Card
                </p>
              </div>

              {/* ID details */}
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-[3%]">
                <div className="min-w-0">
                  <p className="text-[7px] font-bold uppercase tracking-[0.24em] text-white/55"><T k="membership.cardHolder" /></p>
                  <p className="truncate text-[clamp(12px,2.4vw,19px)] font-black uppercase leading-tight tracking-[0.04em] text-white">
                    {card.fanName.trim() || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-[8%] gap-y-[4%]">
                  <div className="min-w-0">
                    <p className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-white/50"><T k="fanCard.fanId" /></p>
                    <p className="font-mono text-[clamp(8px,1.5vw,12px)] font-bold tracking-[0.08em] text-white">
                      {card.fanNumber}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-white/50">Class</p>
                    <p className="truncate text-[clamp(8px,1.5vw,12px)] font-black uppercase tracking-[0.06em] text-white">
                      {classLabel}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-white/50"><T k="fanCard.country" /></p>
                    <p className="truncate text-[clamp(8px,1.5vw,12px)] font-bold text-white">
                      {card.fanCountry || "—"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-white/50"><T k="fanCard.issued" /></p>
                    <p className="text-[clamp(8px,1.5vw,12px)] font-bold text-white">
                      {formatDate(card.registeredAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Bottom strip: chip + barcode + member # ===== */}
            <div className="mt-[5%] flex items-center justify-between gap-[4%] border-t border-white/15 pt-[3.5%]">
              <div className="flex shrink-0 items-center gap-2">
                <CardChip tone={premium ? "gold" : "brand"} />
                <div className="hidden leading-none sm:block">
                  <p className="text-[6px] font-bold uppercase tracking-[0.2em] text-white/50">Member since</p>
                  <p className="mt-0.5 text-[9px] font-black text-white">{formatDate(card.registeredAt).slice(-4)}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-[4%]">
                <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-white/[0.08] px-1 py-[5%] text-white/70 ring-1 ring-white/10">
                  <CardBarcode seed={`${card.fanNumber}:${card.celebrity.slug}:${fail}`} className="opacity-90" />
                </div>
                <div className="shrink-0 overflow-hidden rounded-lg bg-white p-[3px] shadow-md ring-1 ring-white/30">
                  {card.qrCode ? (
                    <Image
                      src={card.qrCode}
                      alt={`QR code for ${card.fanNumber}`}
                      width={64}
                      height={64}
                      className="h-9 w-9 sm:h-11 sm:w-11"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center text-[6px] font-bold text-neutral-600 sm:h-11 sm:w-11">
                      CP
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Micro-credential line under the card (also part of the "real card" feel) */}
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
          {premium ? "Elite Experience · Signature Collection" : "CelebrityPass · Verified Membership"}
        </p>
      </div>
    </div>
  );
}