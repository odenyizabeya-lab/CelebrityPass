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
import { prisma } from "@/lib/db";
import { fetchGoogleInfo, type GoogleInfo } from "@/lib/google-info";
import { EventsUpcoming, EventsHappeningNow, EventsCompleted, EventsIssueSection } from "@/components/events/EventSections";
import { formatFollowerCount } from "@/lib/followers";
import { formatMoney } from "@/lib/payments";
import { getCelebrityBySlug, listActiveCelebritySlugs, type CelebrityDetail } from "@/lib/services";
import { getCelebrityEvents } from "@/lib/events/service";
import { tryParseJson, type SocialLinks } from "@/lib/utils";
import type { MembershipLevelType } from "@/lib/utils";

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
  const socials: SocialLinks = {
    facebook: celebrity.facebookUrl ?? undefined,
    instagram: celebrity.instagramUrl ?? undefined,
    tiktok: celebrity.tiktokUrl ?? undefined,
    google: celebrity.googleUrl ?? undefined,
  };
  const hasMemberships = celebrity.memberships.length > 0;
  const events = await getCelebrityEvents(celebrity.id);
  const lastSyncedAt = events.completed.concat(events.upcoming, events.happening, events.postponed, events.cancelled)
    .map((e) => e.lastSyncedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null;

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

        {/* Verified follower counts */}
        {(celebrity.instagramFollowers || celebrity.tiktokFollowers || celebrity.facebookFollowers) && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FollowerTile icon="instagram" label="Instagram" count={celebrity.instagramFollowers} url={socials.instagram} />
            <FollowerTile icon="tiktok" label="TikTok" count={celebrity.tiktokFollowers} url={socials.tiktok} />
            <FollowerTile icon="facebook" label="Facebook" count={celebrity.facebookFollowers} url={socials.facebook} />
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
        </div>

        {/* Public events */}
        <div className="mt-16 space-y-14">
          <EventsHappeningNow events={events.happening} />
          <EventsUpcoming events={events.upcoming} accent={celebrity.accentColor} lastSyncedAt={lastSyncedAt} />
          <EventsIssueSection events={[...events.postponed, ...events.cancelled]} />
          <EventsCompleted events={events.completed} accent={celebrity.accentColor} />
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
  <h2 className="text-2xl font-black tracking-tight"><T k="membership.onCommunity" /></h2>
  {!hasMemberships ? (
    <div className="mt-4">
      <EmptyState message={<T k="membership.notConfigured" />} />
    </div>
  ) : (
    <div className="mt-8 space-y-12">
      {celebrity.memberships.some((level) => (level.price ?? 0) < PREMIUM_MIN_PRICE) && (
        <div className="grid gap-6 sm:grid-cols-3">
          {celebrity.memberships
            .filter((level) => (level.price ?? 0) < PREMIUM_MIN_PRICE)
            .map((level) => (
              <MembershipLevelCard key={level.id} level={level} slug={celebrity.slug} accent={celebrity.accentColor} />
            ))}
        </div>
      )}
      {celebrity.memberships.some((level) => (level.price ?? 0) >= PREMIUM_MIN_PRICE) && (
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300"><T k="membership.signatureExperiences" /></p>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-400">
            <T k="membership.signatureSub" /> — <T k="membership.from" /> {formatMoney(PREMIUM_MIN_PRICE, "USD")}{" "}
            <T k="membership.to" /> {formatMoney(3000000, "USD")}.
          </p>
          <div className="mt-6 space-y-5">
            {celebrity.memberships
              .filter((level) => (level.price ?? 0) >= PREMIUM_MIN_PRICE)
              .map((level) => (
                <PremiumLevelCard key={level.id} level={level} slug={celebrity.slug} />
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

function MembershipLevelCard({ level, slug, accent }: { level: MembershipLevelType; slug: string; accent: string }) {
  return (
    <div className="glass card-hover flex flex-col rounded-3xl p-6">
      <span className="inline-flex w-fit text-xs font-black uppercase tracking-widest" style={{ color: accent }}>
        <T k="membership.level" vars={{ n: level.displayOrder + 1 }} />
      </span>
      <h3 className="mt-2 text-xl font-bold text-white">{level.name}</h3>
      <p className="mt-2 flex-1 text-base leading-relaxed text-zinc-400">{level.benefits ?? level.description}</p>
      <p className="mt-4 text-xl font-black" style={{ color: accent }}>
        {level.price != null && level.price > 0 ? formatMoney(level.price, level.currency) : formatMoney(0, level.currency)}
      </p>
      <Link
        href={`/celebrity/${slug}/join?level=${level.id}`}
        className="mt-5 rounded-2xl py-3 text-center text-sm font-bold ring-1 ring-white/15 text-white transition hover:bg-white/5"
      >
        <T k="membership.chooseLevel" />
      </Link>
    </div>
  );
}

function PremiumLevelCard({ level, slug }: { level: MembershipLevelType; slug: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-white/[0.02] to-rose-500/[0.04] p-6 sm:p-7">
      <div className="pointer-events-none absolute -inset-x-10 -top-16 h-28 rotate-6 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex w-fit rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
              Experience
            </span>
            <h3 className="text-xl font-black text-white">{level.name}</h3>
          </div>
          {level.description && <p className="mt-2 text-base font-medium text-zinc-300">{level.description}</p>}
        </div>
        <p className="text-xl font-black text-amber-300">
          {level.price != null && level.price > 0 ? formatMoney(level.price, level.currency) : formatMoney(0, level.currency)}
        </p>
      </div>
      <ul className="relative mt-5 space-y-3">
        {benefitLines(level.benefits ?? level.description).map((line) => (
          <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-zinc-300">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400/90" />
            {line}
          </li>
        ))}
      </ul>
      <Link
        href={`/celebrity/${slug}/join?level=${level.id}`}
        className="relative mt-6 inline-flex w-full items-center justify-center rounded-2xl py-3.5 text-center text-base font-bold text-ink-900 transition hover:brightness-110 active:scale-[0.99]"
        style={{ background: "linear-gradient(120deg,#fbbf24,#f59e0b,#f97316)" }}
      >
        <T k="membership.chooseExperience" />
      </Link>
    </div>
  );
}

function SocialLinksRow({ links }: { links: SocialLinks }) {
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