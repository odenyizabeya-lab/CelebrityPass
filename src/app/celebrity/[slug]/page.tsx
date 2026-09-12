import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import CountUp from "@/components/CountUp";
import T from "@/components/T";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";
import VerifiedBadge from "@/components/VerifiedBadge";
import GooglePanel from "@/components/GooglePanel";
import Logo from "@/components/Logo";
import ChatNowButton from "@/components/chat/ChatNowButton";
import { prisma } from "@/lib/db";
import { fetchGoogleInfo, type GoogleInfo } from "@/lib/google-info";
import { formatFollowerCount } from "@/lib/followers";
import { formatMoney } from "@/lib/payments";
import { getCelebrityBySlug, listActiveCelebritySlugs, type CelebrityDetail } from "@/lib/services";
import { canonicalSocialLinks, type CanonicalSocialLinks } from "@/lib/social/resolve";
import { tryParseJson } from "@/lib/utils";
import type { MembershipLevelType } from "@/lib/utils";
import QRCode from "qrcode";

export const revalidate = 60;

/** Canonical production origin. Falls back to the env override if provided. */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://celebritypass.app").replace(/\/$/, "");

const isHttpUrl = (u: string | null | undefined) => (u ? /^https?:\/\//i.test(u) : false);

// Memberships priced at or above this are premium "Signature Experience" tiers.
const PREMIUM_MIN_PRICE = 2500;

function benefitLines(text?: string | null): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Membership fan-card graphics (realistic card visuals, not text boxes).
// ---------------------------------------------------------------------------

const CARD_TAGLINES = {
  standard: ["Be Closer Than Ever"],
  vip: ["EXCLUSIVE ACCESS", "PRIORITY EXPERIENCES", "A HIGHER LEVEL OF FANDOM"],
} as const;

const CARD_ICON_LABELS = {
  standard: ["Exclusive Content", "Priority Community", "Verified Fan ID", "Fan-Only Updates"],
  vip: ["VIP Card Design", "Premium Support", "Recognition Badge", "Early Access"],
} as const;

const CARD_DEFAULT_FEATURES = {
  standard: ["Unique verified Fan ID", "Live card link + QR code", "Priority community news", "Exclusive digital content", "Access to fan-only updates"],
  vip: ["Everything in Premium", "Exclusive VIP card design", "Premium support", "Special recognition badge", "Top-tier community status", "Early access to events & new features"],
} as const;

const cardIconCls = "h-4 w-4 shrink-0";
function IconDoc() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a2 2 0 011.4.6l3.4 3.4a2 2 0 01.6 1.4V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-6 0M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.6.6 0 011.04 0l2.13 3.9 4.36.8a.6.6 0 01.33 1.02l-3.24 3.14.82 4.47a.6.6 0 01-.87.63L12 15.75l-4.05 2.11a.6.6 0 01-.87-.63l.82-4.47-3.24-3.14a.6.6 0 01.33-1.02l4.36-.8 2.13-3.9z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}
function IconDiamond() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 12L2 9l4-6zm0 0l4 6m12-6l-4 6M2 9h20" />
    </svg>
  );
}
function IconHeadset() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 14v-2a8 8 0 0116 0v2M4 14a2 2 0 01-2-2v-1a2 2 0 012-2h1v5H4zm16 0a2 2 0 012-2v-1a2 2 0 00-2-2h-1v5h1zm-12 7h8M6 14v3a2 2 0 002 2h2M18 14v3a2 2 0 01-2 2h-2" />
    </svg>
  );
}
function IconBadge() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.6 12.6L7 22l5-3 5 3-1.6-9.4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg className={cardIconCls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3.5V7m8-3.5V7M3.5 10.5h17" />
    </svg>
  );
}

const CARD_ICONS = {
  standard: [IconDoc, IconPeople, IconStar, IconLock],
  vip: [IconDiamond, IconHeadset, IconBadge, IconCalendar],
} as const;

/** Scannable QR code (SVG) pointing at the join flow for a level. */
async function cardQrSvg(text: string): Promise<string> {
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      width: 160,
      color: { dark: "#0b0c10", light: "#ffffff" },
    });
    return svg.replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
  } catch {
    return "";
  }
}

type Props = { params: Promise<{ slug: string }> };

/** Pre-render every public community so navigation is instant (prefetched, no server roundtrip on click). */
export async function generateStaticParams() {
  return listActiveCelebritySlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCelebrityBySlug(slug);
  if (!c) return { title: "Not Found" };

  const url = `${APP_URL}/celebrity/${c.slug}`;
  const description =
    c.tagline || `${c.name} — ${c.profession}${c.country ? ` · ${c.country}` : ""} | Official CelebrityPass profile.`;
  // Only a hosted image is usable by social crawlers (data: URIs are ignored
  // by WhatsApp/Facebook/X). Each celebrity's own photo is used — never a
  // shared generic image when a real profile photo exists.
  const image = c.profileImageUrl ? `${APP_URL}${c.profileImageUrl}` : isHttpUrl(c.profileImage) ? c.profileImage : undefined;
  const ogTitle = c.name;

  return {
    title: c.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: ogTitle,
      description: `Official CelebrityPass profile for ${c.name}.`,
      url,
      siteName: "CelebrityPass",
      firstName: c.name.split(" ").slice(0, 1).join(" ") || undefined,
      username: c.slug,
      ...(image ? { images: [{ url: image, alt: `${c.name} — CelebrityPass profile` }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: ogTitle,
      description: `Official CelebrityPass profile for ${c.name}.`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function CelebrityPage({ params }: Props) {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) notFound();

  // Guarantee the Google-style knowledge panel for EVERY celebrity, forever.
  // New/AI-created celebrities get theirs during creation (background fetch),
  // and the profile page self-heals any that ever come up missing — it fetches
  // once, stores the panel, then renders the same rich knowledge panel as the
  // other communities. Failures never break the page; they just leave the (rare)
  // no-data case blank until a later visit succeeds.
  let panel: GoogleInfo | null = celebrity.googleInfo;
  if (!panel) {
    try {
      const info = await fetchGoogleInfo(celebrity.name, {
        profession: celebrity.profession,
        category: celebrity.category,
      });
      if (info) {
        await prisma.celebrity.update({
          where: { id: celebrity.id },
          data: { googleInfo: JSON.stringify(info) },
        });
        panel = info;
      }
    } catch {
      /* the rest of the profile still renders */
    }
  }

  // The four permanent, verified platform links (source of truth).
  // Google is always present (deterministic official-result search page for the
  // exact name); Facebook/Instagram/TikTok render only when a verified official
  // URL exists — never a guessed or placeholder link.
  const socials = canonicalSocialLinks(celebrity.name, {
    facebook: celebrity.facebookUrl,
    instagram: celebrity.instagramUrl,
    tiktok: celebrity.tiktokUrl,
    google: celebrity.googleUrl,
  });

  // Self-heal (same pattern as the Google knowledge panel above): persist the
  // canonical values so the database converges — Google filled when missing,
  // junk/placeholder URLs cleaned to null. Runs only until the stored columns
  // match; failures never break the page.
  try {
    const patches: { facebookUrl?: string | null; instagramUrl?: string | null; tiktokUrl?: string | null; googleUrl?: string | null } = {};
    const patchField = <K extends "facebook" | "instagram" | "tiktok" | "google">(platform: K) => {
      const field = `${platform}Url` as const;
      const canonical = socials[platform] ?? null;
      if ((celebrity[field] ?? null) !== canonical) patches[field] = canonical;
    };
    patchField("facebook");
    patchField("instagram");
    patchField("tiktok");
    patchField("google");
    if (Object.keys(patches).length > 0) {
      await prisma.celebrity.update({ where: { id: celebrity.id }, data: patches });
    }
  } catch {
    /* the rest of the profile still renders */
  }

  // A platform tile shows only when it has a real, clickable link AND a count —
  // a platform that isn't verified on a network is simply not shown.
  const followerTiles = [
    { icon: "instagram" as const, label: "Instagram", count: celebrity.instagramFollowers, url: socials.instagram },
    { icon: "tiktok" as const, label: "TikTok", count: celebrity.tiktokFollowers, url: socials.tiktok },
    { icon: "facebook" as const, label: "Facebook", count: celebrity.facebookFollowers, url: socials.facebook },
  ].filter((t): t is { icon: "instagram" | "tiktok" | "facebook"; label: string; count: number | null; url: string } =>
    typeof t.url === "string" && (t.count ?? null) != null
  );
  const hasMemberships = celebrity.memberships.length > 0;
  const standardTiers = celebrity.memberships.filter((l) => (l.price ?? 0) < PREMIUM_MIN_PRICE);
  const premiumTiers = celebrity.memberships.filter((l) => (l.price ?? 0) >= PREMIUM_MIN_PRICE);
  const firstName = (celebrity.name.trim().split(/\s+/)[0] ?? celebrity.name).trim();

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: celebrity.name,
              ...(celebrity.profession ? { jobTitle: celebrity.profession } : {}),
              ...(celebrity.country ? { address: { "@type": "PostalAddress", addressCountry: celebrity.country } } : {}),
              ...(isHttpUrl(celebrity.profileImage) ? { image: celebrity.profileImage } : {}),
              url: `${APP_URL}/celebrity/${celebrity.slug}`,
            },
          }),
        }}
      />
      {/* Cover */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        {celebrity.coverImageUrl ? (
          <Image src={celebrity.coverImageUrl} alt="" fill priority sizes="100vw" className="object-cover" unoptimized />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(115deg, ${celebrity.accentColor}, #27104a 45%, #0b0c10)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
        <div className="absolute left-4 top-4 z-20">
          <BackButton />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* Profile header */}
        <div className="relative z-10 -mt-24 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="w-[320px] max-w-full shrink-0 sm:w-[450px] lg:w-[560px]">
            <div className="rounded-3xl bg-ink-900 p-2 shadow-2xl ring-4 ring-ink-900">
              {celebrity.profileImageUrl ? (
                <Image
                  src={celebrity.profileImageUrl}
                  alt={celebrity.name}
                  width={celebrity.profileImageW}
                  height={celebrity.profileImageH}
                  sizes="(max-width: 639px) 320px, (max-width: 1023px) 450px, 560px"
                  priority
                  className="h-auto w-full object-contain"
                />
              ) : (
                <div
                  className="grid aspect-[4/5] w-full place-items-center rounded-2xl text-4xl font-black text-white sm:text-5xl"
                  style={{ backgroundColor: celebrity.accentColor }}
                >
                  {celebrity.name.slice(0, 1)}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {celebrity.name}
              </h1>
              {celebrity.isVerified && <VerifiedBadge className="h-6 w-6 sm:h-7 sm:w-7" />}
              <span
                className="rounded-full px-3.5 py-1.5 text-sm font-bold text-white"
                style={{ backgroundColor: celebrity.accentColor }}
              >
                {celebrity.category}
              </span>
            </div>
            {/* Profession/title directly below the name, Google knowledge-panel style */}
            <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {celebrity.profession}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <SocialLinksRow links={socials} />
            </div>
          </div>
        </div>

        {/* Google-style knowledge panel for this exact celebrity */}
        {panel && (
          <GooglePanel info={panel} category={celebrity.category} />
        )}

        {/* Verified follower counts — tiles render only when a platform also
            has a verified, clickable link, so nothing shown is ever a dead end. */}
        {followerTiles.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {followerTiles.map((t) => (
              <FollowerTile key={t.icon} icon={t.icon} label={t.label} count={t.count} url={t.url} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="glass rounded-3xl px-6 py-5">
            <p className="text-3xl font-black text-white">
              <CountUp value={celebrity.fanCount} />
            </p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-500"><T k="membership.registeredFans" /></p>
          </div>
          <div className="glass rounded-3xl px-6 py-5">
            <p className="text-3xl font-black text-white">
              <CountUp value={celebrity.countryCount} />
            </p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-500"><T k="countries.title" /></p>
          </div>
          <div className="glass rounded-3xl px-6 py-5">
            <p className="text-3xl font-black text-white">{celebrity.memberships.length}</p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-500"><T k="membership.onCommunity" /></p>
          </div>
          <div className="glass rounded-3xl px-6 py-5">
            <p className="text-3xl font-black text-white">{celebrity.isFeatured ? <><span aria-hidden>*</span> <T k="membership.featured" /></> : <T k="membership.open" />}</p>
            <p className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-500"><T k="membership.communityStatus" /></p>
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={`/celebrity/${celebrity.slug}/join`}
            className="btn-grad inline-flex items-center gap-2.5 rounded-full px-9 py-4 text-base font-bold text-white transition active:scale-[0.98]"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
            </svg>
            <T k="join.getFanCard" />
          </Link>
          <Link
            href={`/celebrity/${celebrity.slug}/join`}
            className="inline-flex items-center gap-2.5 rounded-full px-9 py-4 text-base font-bold text-white ring-1 ring-white/20 transition hover:bg-white/5 active:scale-[0.98]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-6 0M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <T k="join.joinCommunity" />
          </Link>
          <ChatNowButton celebrityId={celebrity.id} />
        </div>

        {/* Body grid */}
        <div className="mt-16 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          {/* Bio + community info */}
          <div className="space-y-14">
            <section>
              <h2 className="text-2xl font-black tracking-tight"><T k="membership.aboutCommunity" /></h2>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-500">
                CelebrityPass hosts independent fan membership communities. Fan cards are issued by the platform on behalf of
                each community and do not represent contracts with, or endorsement by, the celebrity.
              </p>
            </section>

<section>
  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">Join The Exclusive Community</p>
  <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
    Membership <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">Levels</span>
  </h2>
  <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-400">
    Get your official CelebrityPass fan card and unlock a world of exclusive experiences, content and more.
  </p>
  {!hasMemberships ? (
    <div className="mt-6">
      <EmptyState message={<T k="membership.notConfigured" />} />
    </div>
  ) : (
    <div className="mt-10 space-y-14">
      {standardTiers.length > 0 && (
        <div className="space-y-8">
          {standardTiers.map((level, i) => (
            <MembershipLevelCard
              key={level.id}
              level={level}
              slug={celebrity.slug}
              celebrityName={celebrity.name}
              imageUrl={celebrity.profileImageUrl}
              firstName={firstName}
              variant={i === standardTiers.length - 1 ? "vip" : "standard"}
              levelNumber={i + 1}
            />
          ))}
        </div>
      )}
      {premiumTiers.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300"><T k="membership.signatureExperiences" /></p>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-400">
            <T k="membership.signatureSub" /> — <T k="membership.from" /> {formatMoney(PREMIUM_MIN_PRICE, "USD")}{" "}
            <T k="membership.to" /> {formatMoney(3000000, "USD")}.
          </p>
          <div className="mt-6 space-y-8">
            {premiumTiers.map((level) => (
              <SignatureExperienceCard
                key={level.id}
                level={level}
                slug={celebrity.slug}
                celebrityName={celebrity.name}
                imageUrl={celebrity.profileImageUrl}
                firstName={firstName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )}
</section>
          </div>

          {/* Fan card preview */}
          <aside>
            <div className="lg:sticky lg:top-24">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500"><T k="membership.fanCardPreview" /></h3>
              <div className="mt-4">
                <CardPreview celebrity={celebrity} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                <T k="membership.fanCardPreviewSub" vars={{ name: celebrity.name }} />
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Realistic credit-card-style graphic shown beside each level's details. */
async function LevelCardGraphic({
  variant,
  name,
  tierName,
  levelNumber,
  popular,
  experience,
  imageUrl,
  firstName,
  qrValue,
}: {
  variant: "standard" | "vip" | "elite";
  name: string;
  tierName: string;
  levelNumber: number;
  popular: boolean;
  experience: boolean;
  imageUrl: string | null;
  firstName: string;
  qrValue: string;
}) {
  const qr = await cardQrSvg(qrValue);
  const taglines = variant === "vip" || variant === "elite" ? CARD_TAGLINES.vip : CARD_TAGLINES.standard;
  const neon = variant === "standard" ? "#7dd3fc" : "#fcd34d";
  const gold = "#fcd34d";
  const bg =
    variant === "elite"
      ? "linear-gradient(125deg,#1b1510 0%,#3a2b16 46%,#0b0c10 100%)"
      : variant === "vip"
        ? "linear-gradient(120deg,#2b1045 0%,#6d28d9 42%,#1f1236 100%)"
        : "linear-gradient(120deg,#0b1330 0%,#1e3a8a 48%,#0b1026 100%)";

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15"
      style={{ background: bg, aspectRatio: "1.62 / 1" }}
    >
      <div className="pointer-events-none absolute -inset-x-8 -top-16 h-40 rotate-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {(variant === "vip" || variant === "elite") && (
        <div className="pointer-events-none absolute -left-8 top-1/3 h-32 w-24 rotate-[24deg] bg-gradient-to-r from-transparent via-amber-200/15 to-transparent" />
      )}
      <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.06]" aria-hidden>
        <span className="text-7xl font-black tracking-widest text-white">
          {name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
        </span>
      </div>

      {/* Vertical tagline strip (right edge) */}
      <div className="absolute inset-y-4 right-1.5 z-10 hidden flex-col items-center justify-center gap-1.5 sm:flex">
        {taglines.map((t) => (
          <span
            key={t}
            className="text-[8px] font-black uppercase tracking-[0.3em]"
            style={{ color: neon, writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
        {/* Top: brand + CP badge */}
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white">
            Celebrity<span style={{ color: neon }}>Pass</span>
          </span>
          <div className="flex items-center gap-1.5">
            {experience && (
              <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
                Experience
              </span>
            )}
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-black text-ink-900 shadow">
              <Logo size="xs" className="rounded-lg" />
            </span>
          </div>
        </div>

        {/* Middle: tier */}
        <div>
          <p className="text-xl font-black uppercase tracking-[0.12em] text-white sm:text-2xl">{tierName}</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/70">Official Fan Card</p>
        </div>

        {/* Bottom: photo + identity left, signature + QR right */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ring-white/30">
              {imageUrl ? (
                <Image src={imageUrl} alt={name} width={48} height={60} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="grid h-full w-full place-items-center text-base font-black text-white" style={{ backgroundColor: neon }}>
                  {name[0]}
                </div>
              )}
            </div>
            <div>
              {levelNumber > 0 && (
                <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: neon }}>
                  Level {levelNumber}
                </p>
              )}
              <p className="text-sm font-black uppercase tracking-[0.08em] text-white sm:text-base">{name}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">
                {popular && <span style={{ color: gold }}>★ </span>}Member
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span
              className="text-base leading-none text-white/80 sm:text-lg"
              style={{ fontFamily: '"Brush Script MT","Segoe Script","Apple Chancery",cursive' }}
            >
              {firstName}
            </span>
            {qr ? (
              <div className="h-14 w-14 overflow-hidden rounded-lg bg-white p-1 shadow-lg ring-1 ring-white/30">
                <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              </div>
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-white/90 text-[8px] font-black uppercase tracking-widest text-ink-900 shadow">
                <Logo size="sm" className="rounded-md" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembershipLevelCard({
  level,
  slug,
  celebrityName,
  imageUrl,
  firstName,
  variant,
  levelNumber,
}: {
  level: MembershipLevelType;
  slug: string;
  celebrityName: string;
  imageUrl: string | null;
  firstName: string;
  variant: "standard" | "vip";
  levelNumber: number;
}) {
  const popular = variant === "vip";
  const features = benefitLines(level.benefits ?? level.description);
  const featureList = features.length > 0 ? features : [...CARD_DEFAULT_FEATURES[variant]];
  const qrValue = `/celebrity/${slug}/join?level=${level.id}`;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 ${
        popular
          ? "bg-gradient-to-br from-fuchsia-950/40 via-ink-900 to-ink-900 shadow-[0_24px_80px_-24px_rgba(168,85,247,0.45)] ring-2 ring-amber-400/40"
          : "bg-gradient-to-br from-sky-950/40 via-ink-900 to-ink-900 shadow-[0_24px_80px_-24px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/25"
      }`}
    >
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ring-1 ${
                popular ? "bg-amber-400/10 text-amber-300 ring-amber-400/40" : "bg-sky-400/10 text-sky-300 ring-sky-400/40"
              }`}
            >
              Level {levelNumber}
            </span>
            {popular && (
              <>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-ink-900">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />
                  </svg>
                </span>
                <span className="inline-flex rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow">
                  Most Popular
                </span>
              </>
            )}
          </div>

          <h3
            className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${
              popular ? "bg-gradient-to-r from-amber-200 via-amber-300 to-fuchsia-300 bg-clip-text text-transparent" : "text-white"
            }`}
          >
            {level.name}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-zinc-400">
            {popular ? "Everything in Premium, plus so much more." : `Official digital fan card for ${celebrityName}`}
          </p>
          <p className={`mt-3 text-2xl font-black ${popular ? "text-fuchsia-300" : "text-sky-300"}`}>
            {level.price != null && level.price > 0 ? formatMoney(level.price, level.currency) : formatMoney(0, level.currency)}
          </p>

          <ul className="mt-4 space-y-2">
            {featureList.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <Link
            href={qrValue}
            className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] ${
              popular
                ? "bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 shadow-[0_10px_30px_-6px_rgba(244,114,182,0.55)]"
                : "bg-sky-500 shadow-[0_10px_30px_-6px_rgba(56,189,248,0.5)]"
            }`}
          >
            <T k="membership.chooseLevel" />
            <span aria-hidden>›</span>
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
            {CARD_ICONS[variant].map((Icon, i) => (
              <div key={CARD_ICON_LABELS[variant][i]} className="flex items-center gap-2 text-xs text-zinc-400">
                <Icon />
                <span>{CARD_ICON_LABELS[variant][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <LevelCardGraphic
            variant={variant}
            name={celebrityName}
            tierName={level.name}
            levelNumber={levelNumber}
            popular={popular}
            experience={false}
            imageUrl={imageUrl}
            firstName={firstName}
            qrValue={qrValue}
          />
        </div>
      </div>
    </div>
  );
}

function SignatureExperienceCard({
  level,
  slug,
  celebrityName,
  imageUrl,
  firstName,
}: {
  level: MembershipLevelType;
  slug: string;
  celebrityName: string;
  imageUrl: string | null;
  firstName: string;
}) {
  const features = benefitLines(level.benefits ?? level.description);
  const featureList = features.length > 0 ? features : [];
  const qrValue = `/celebrity/${slug}/join?level=${level.id}`;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/40 via-ink-900 to-ink-900 p-6 shadow-[0_24px_80px_-24px_rgba(245,158,11,0.4)] ring-2 ring-amber-400/40 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40">
              Signature Experience
            </span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-ink-900">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />
              </svg>
            </span>
          </div>

          <h3 className="mt-3 bg-gradient-to-r from-amber-200 via-amber-300 to-rose-300 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            {level.name}
          </h3>
          {level.description && <p className="mt-2 text-base font-medium text-zinc-300">{level.description}</p>}
          <p className="mt-3 text-2xl font-black text-amber-300">
            {level.price != null && level.price > 0 ? formatMoney(level.price, level.currency) : formatMoney(0, level.currency)}
          </p>

          {featureList.length > 0 && (
            <ul className="mt-4 space-y-2">
              {featureList.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          )}

          <Link
            href={qrValue}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 px-7 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-6px_rgba(245,158,11,0.55)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <T k="membership.chooseLevel" />
            <span className="ml-2" aria-hidden>›</span>
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
            {CARD_ICONS.vip.map((Icon, i) => (
              <div key={CARD_ICON_LABELS.vip[i]} className="flex items-center gap-2 text-xs text-zinc-400">
                <Icon />
                <span>{CARD_ICON_LABELS.vip[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <LevelCardGraphic
            variant="elite"
            name={celebrityName}
            tierName={level.name}
            levelNumber={0}
            popular
            experience
            imageUrl={imageUrl}
            firstName={firstName}
            qrValue={qrValue}
          />
        </div>
      </div>
    </div>
  );
}

function SocialLinksRow({ links }: { links: CanonicalSocialLinks }) {
  const items = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
    { key: "google", label: "Google" },
  ] as const;
  const available = items.filter((i) => {
    const url = links?.[i.key];
    return typeof url === "string" && url.trim().length > 0;
  });
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {available.map((i) => {
        const url = (links[i.key] ?? "").trim();
        return (
          <a
            key={i.key}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${i.label} — ${links[i.key]}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-bold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white hover:ring-white/25"
          >
            <PlatformIcon icon={i.key} className="h-4 w-4" />
            {i.label}
          </a>
        );
      })}
    </div>
  );
}

function CardPreview({ celebrity }: { celebrity: CelebrityDetail }) {
  const design = tryParseJson<{ accent?: string; badgeText?: string }>(celebrity.cardDesign ? JSON.stringify(celebrity.cardDesign) : null, {});
  const accent = design.accent ?? "#f59e0b";
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/10"
      style={{
        background: `linear-gradient(130deg, ${celebrity.accentColor}, #27104a 45%, #0b0c10)`,
      }}
    >
      <div className="pointer-events-none absolute -inset-x-10 -top-20 h-40 rotate-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/20 text-sm font-black text-white backdrop-blur-sm">
            {celebrity.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-black text-white">{celebrity.name}</p>
              {celebrity.isVerified && <VerifiedBadge className="h-4 w-4" />}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/60"><T k="membership.officialMembership" /></p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50"><T k="membership.cardHolder" /></p>
            <p className="text-base font-black text-white/80"><T k="membership.yourNameHere" /></p>
            <p className="mt-1.5 font-mono text-[11px] text-white/70">
              FC-000000
              <span className="ml-2 text-white/50"><T k="membership.sampleId" /></span>
            </p>
          </div>
          <div className="rounded-md bg-white p-1.5">
            <div className="grid h-12 w-12 place-items-center text-[8px] font-bold text-ink-600">YOUR QR</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
          <span className="h-4 w-6 rounded-sm bg-gradient-to-br from-amber-200 to-amber-600" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
            {design.badgeText ?? "FAN CARD"}
          </p>
        </div>
      </div>
    </div>
  );
}

function FollowerTile({
  icon,
  label,
  count,
  url,
}: {
  icon: "instagram" | "tiktok" | "facebook";
  label: string;
  count: number | null | undefined;
  url?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2.5">
        <PlatformIcon icon={icon} />
        <span className="text-base font-semibold text-zinc-400">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-black text-white">{formatFollowerCount(count)}</p>
      <p className="mt-1 text-sm text-zinc-500">followers</p>
    </>
  );
  const cls = "glass card-hover block rounded-3xl px-6 py-5";
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PlatformIcon({ icon, className }: { icon: "instagram" | "tiktok" | "facebook" | "google"; className?: string }) {
  const cls = className ?? "h-5 w-5";
  if (icon === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.6a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 2.2a4 4 0 110 8 4 4 0 010-8zm6.4-3.8a1.4 1.4 0 11-2.8 0 1.4 1.4 0 012.8 0z" />
      </svg>
    );
  }
  if (icon === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M16.6 5.82A4.28 4.28 0 0115.55 3h-3.09v12.4a2.59 2.59 0 01-2.6 2.65 2.59 2.59 0 01-2.6-2.59 2.59 2.59 0 012.6-2.6c.26 0 .52.05.75.12V9.83a5.7 5.7 0 00-.75-.05 5.66 5.66 0 00-5.66 5.65 5.66 5.66 0 005.66 5.66 5.66 5.66 0 005.66-5.66V8.99a7.3 7.3 0 004.27 1.37V7.27a4.3 4.3 0 01-1.83.73 4.35 4.35 0 01-2.45-2.18z" />
      </svg>
    );
  }
  if (icon === "google") {
    return (
      <svg viewBox="0 0 48 48" className={cls} aria-hidden>
        <path
          fill="#FFC107"
          d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.7 16.3 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.7l6.3 5.3C36.9 40.8 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
      <path d="M24 12.07C24 5.44 18.63 0 12 0S0 5.44 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
  );
}