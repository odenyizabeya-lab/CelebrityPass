import Link from "next/link";
import Image from "next/image";
import type { Metadata, Viewport } from "next";
import CountUp from "@/components/CountUp";
import AppSearch from "@/components/AppSearch";
import FaqSection from "@/components/FaqSection";
import T from "@/components/T";
import WelcomeScreen from "@/components/welcome/WelcomeScreen";
import { getCelebritySummaries, getRepresentedCountries, toCardCelebrity } from "@/lib/services";
import { safeAsync } from "@/lib/safe-data";
import { formatMoney } from "@/lib/payments";
import { appUrl } from "@/lib/utils";
import { isOnboarded } from "@/lib/onboarding";

export const revalidate = 60;

const BASE = appUrl();

export const metadata: Metadata = {
  title: "Your Connection to the World You Love",
  description:
    "Discover your favorite celebrities, public figures, creators, and businesses all in one place. Join communities, explore exclusive experiences, and discover business, investment, and trading opportunities — CelebrityPass.",
  alternates: { canonical: `${BASE}/` },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "CelebrityPass",
    title: "CelebrityPass — Your Connection to the World You Love",
    description:
      "Discover celebrities, fan communities, exclusive experiences, and business & investment opportunities — all in one premium app experience.",
  },
  twitter: {
    card: "summary",
    title: "CelebrityPass — Your Connection to the World You Love",
    description:
      "Discover celebrities, fan communities, exclusive experiences, and business & investment opportunities — all in one premium app experience.",
  },
};

// Full-screen app search overlay: let the Android keyboard resize the viewport
// exactly like the native chat app does, so nothing hides behind the keys.
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

// Global base membership tiers: LEVEL 1 = Silver $200, LEVEL 2 = Gold $350,
// LEVEL 3 = Platinum $500, LEVEL 4 = Premium $1,000, LEVEL 5 = VIP $1,700 (USD).
const BASE_TIERS = [
  {
    id: "silver",
    nameKey: "membership.silverName",
    level: 1,
    price: 200,
    perks: ["membership.silverPerk1", "membership.silverPerk2", "membership.silverPerk3", "membership.silverPerk4", "membership.silverPerk5"],
    featured: false,
  },
  {
    id: "gold",
    nameKey: "membership.goldName",
    level: 2,
    price: 350,
    perks: ["membership.goldPerk1", "membership.goldPerk2", "membership.goldPerk3", "membership.goldPerk4", "membership.goldPerk5"],
    featured: false,
  },
  {
    id: "platinum",
    nameKey: "membership.platinumName",
    level: 3,
    price: 500,
    perks: ["membership.platinumPerk1", "membership.platinumPerk2", "membership.platinumPerk3", "membership.platinumPerk4", "membership.platinumPerk5"],
    featured: false,
  },
  {
    id: "premium",
    nameKey: "membership.premiumName",
    level: 4,
    price: 1000,
    perks: ["membership.premiumPerk1", "membership.premiumPerk2", "membership.premiumPerk3", "membership.premiumPerk4", "membership.premiumPerk5"],
    featured: false,
  },
  {
    id: "vip",
    nameKey: "membership.vipName",
    level: 5,
    price: 1700,
    perks: ["membership.vipPerk1", "membership.vipPerk2", "membership.vipPerk3", "membership.vipPerk4", "membership.vipPerk5"],
    featured: true,
  },
];

function formatCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}K`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
}

export default async function HomePage() {
  // Data fetching never crashes the page: a DB/network failure resolves to empty
  // fallbacks and the shell (hero, ecosystem, membership, FAQ…) still renders.
  const onboarded = await safeAsync(async () => isOnboarded(), false);
  const [representedCountries, celebrities] = await Promise.all([
    safeAsync(async () => getRepresentedCountries(), []),
    safeAsync(async () => getCelebritySummaries(), []),
  ]);

  const featured = celebrities.filter((c) => c.isFeatured).slice(0, 3);
  const featuredIds = new Set(featured.map((c) => c.id));
  const popular = [...celebrities]
    .filter((c) => !featuredIds.has(c.id))
    .sort((a, b) => b.fanCount - a.fanCount)
    .slice(0, 8);
  const worldLeaders = celebrities.filter((c) => c.isWorldLeader).slice(0, 8);
  const totalActive = celebrities.length;
  const totalFans = celebrities.reduce((sum, c) => sum + c.fanCount, 0);

  const railCovers = [...featured, ...popular, ...worldLeaders].filter(Boolean);

  return (
    <div>
      {!onboarded && <WelcomeScreen />}
      <div className="overflow-hidden">
        {/* ============ HERO (app welcome) ============ */}
        <section className="relative pt-8">
          <div className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-primary-600/25 blur-[110px]" />
          <div className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-accent-500/15 blur-[100px]" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-400">CelebrityPass</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-white">
              <span className="gradient-text">Your Connection</span>
              <br />
              to the World You Love
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Discover your favorite celebrities, public figures, creators, and businesses all in one place.
            </p>

            {/* Ecosystem chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Discover",
                "Connect",
                "Explore",
                "Invest",
                "Trade",
                "Opportunities",
              ].map((word) => (
                <span
                  key={word}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[12px] font-bold text-zinc-300"
                >
                  {word}
                </span>
              ))}
            </div>

            <AppSearch placeholder="Search celebrities, communities, businesses…" />
          </div>

          {/* App primary buttons */}
          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/celebrities"
              className="btn-grad rounded-2xl px-5 py-3.5 text-center text-[14px] font-bold text-white"
            >
              Explore Celebrities
            </Link>
            <Link
              href="/celebrities"
              className="rounded-2xl bg-white/[0.06] px-5 py-3.5 text-center text-[14px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              Join a Community
            </Link>
            <Link
              href="#opportunities"
              className="rounded-2xl bg-white/[0.06] px-5 py-3.5 text-center text-[14px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              Explore Opportunities
            </Link>
            <Link
              href="/invest"
              className="rounded-2xl bg-white/[0.06] px-5 py-3.5 text-center text-[14px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              Investment &amp; Trading
            </Link>
          </div>

          {/* Live stats */}
          <div className="relative mt-7 grid grid-cols-3 gap-3">
            {[
              { label: "Communities", value: totalActive, raw: true },
              { label: "Registered Fans", value: totalFans, raw: false },
              { label: "Countries", value: representedCountries.length, raw: true },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl px-2 py-3 text-center">
                <p className="text-xl font-black text-white">
                  {s.raw ? (
                    <CountUp value={s.value} />
                  ) : (
                    <CountUp value={s.value} compact />
                  )}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ ECOSYSTEM CARDS (6) ============ */}
        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent-400">The ecosystem</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Everything CelebrityPass brings together</h2>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <EcoCard
              href="/celebrities"
              title="Celebrities"
              sub="Discover the stars you love"
              image={railCovers[0]?.coverImageUrl ?? null}
              accent="#7c3aed"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0 17.9 17.9 0 01-7.5 1.65 17.9 17.9 0 01-7.5-1.65z" />
                </svg>
              }
            />
            <EcoCard
              href="/celebrities"
              title="Fan Communities"
              sub="Join the official fandom"
              image={railCovers[1]?.coverImageUrl ?? null}
              accent="#d946ef"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M14 20H3v-2a4 4 0 014-4h1a4 4 0 013.5 2.13M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <EcoCard
              href="#opportunities"
              title="Business Opportunities"
              sub="Explore, learn, decide"
              image={null}
              accent="#f59e0b"
              gradient
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.93 23.93 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <EcoCard
              href="/discovery"
              title="Exclusive Experiences"
              sub="VIP · meet & greets · events"
              image={null}
              accent="#e879f9"
              gradient
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
            />
            <EcoCard
              href="/invest"
              title="Investment"
              sub="Research opportunities"
              image={null}
              accent="#8b5cf6"
              gradient
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-14v5l3 3M12 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              }
            />
            <EcoCard
              href="/invest"
              title="Trading"
              sub="Shorting, markets & more"
              image={null}
              accent="#f43f5e"
              gradient
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m5 10V4m5 16v-8m5 8V7M3 20h18" />
                </svg>
              }
            />
          </div>
        </section>

        {/* ============ OPPORTUNITIES (professional, no returns promised) ============ */}
        <section id="opportunities" className="mt-10 scroll-mt-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-400">Opportunities</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Explore business, investment &amp; trading</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            Explore business, investment, and trading opportunities alongside the world of entertainment and celebrity
            communities. Discover opportunities, learn more, and make informed decisions.
          </p>

          <div className="mt-5 space-y-3">
            <OpportunityCard
              href="/invest"
              title="Investment"
              desc="Research public companies and global opportunities side by side with entertainment markets. Nothing on CelebrityPass promises returns — explore, learn, and decide for yourself."
              cta="Explore Investment"
            />
            <OpportunityCard
              href="/invest"
              title="Trading"
              desc="Study markets including shorting, with transparent data and education-first tools. Build understanding before you act — always your own goals, your own risk."
              cta="Explore Trading"
            />
            <OpportunityCard
              href="#opportunities"
              title="Business"
              desc="Every celebrity on CelebrityPass is also a business. Follow your favorite public figures and creators as ventures, markets, and brands."
              cta="Explore Business"
            />
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
            Educational only. Markets carry risk, and past performance never guarantees future results. Nothing shown
            here is financial advice or a promise of profit.
          </p>
        </section>

        {/* ============ COMMUNITY RAILS ============ */}
        {worldLeaders.length > 0 && (
          <section className="mt-10">
            <RailHeader eyebrow="World Leaders" title={<T k="home.presidents" />} href="/celebrities" />
            <Rail items={worldLeaders} />
          </section>
        )}
        {featured.length > 0 && (
          <section className="mt-9">
            <RailHeader eyebrow="Featured" title={<T k="home.featuredCommunities" />} href="/celebrities" />
            <Rail items={featured} />
          </section>
        )}
        {popular.length > 0 && (
          <section className="mt-9">
            <RailHeader eyebrow="Popular" title={<T k="home.popularCommunities" />} href="/celebrities" />
            <Rail items={popular} />
          </section>
        )}

        {/* ============ LONGER DESCRIPTION (lower on the page) ============ */}
        <section className="mt-10 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight text-white">One pass to the world you love</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-zinc-400">
            <p>
              Discover your favorite celebrities, public figures, creators, and businesses all in one place. Join
              communities, explore exclusive experiences, discover new opportunities, and stay connected to the people
              and brands you care about.
            </p>
            <p>
              Explore business, investment, and trading opportunities alongside the world of entertainment and celebrity
              communities. Discover opportunities, learn more, and make informed decisions.
            </p>
            <p>
              From unforgettable fan moments to exciting new opportunities — CelebrityPass brings connection, discovery,
              entertainment, and opportunities together in one place.
            </p>
          </div>
          <Link
            href="/celebrities"
            className="btn-grad mt-6 inline-block rounded-full px-7 py-3 text-sm font-bold text-white"
          >
            Explore Celebrities
          </Link>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section id="how-it-works" className="mt-10 scroll-mt-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-400">
            <T k="home.howItWorks" />
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            <T k="home.howItWorksTitle" />
          </h2>
          <div className="mt-5 space-y-3">
            {[
              { n: "01", t: "home.step1T", d: "home.step1D" },
              { n: "02", t: "home.step2T", d: "home.step2D" },
              { n: "03", t: "home.step3T", d: "home.step3D" },
              { n: "04", t: "home.step4T", d: "home.step4D" },
            ].map((step, i) => (
              <div
                key={step.n}
                className="glass card-hover flex items-start gap-4 rounded-2xl p-5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="gradient-text text-3xl font-black">{step.n}</span>
                <div>
                  <h3 className="text-[15px] font-bold text-white">
                    <T k={step.t} />
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    <T k={step.d} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ MEMBERSHIP LEVELS ============ */}
        <section id="membership" className="mt-10 scroll-mt-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent-400">
            <T k="membership.title" />
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            <T k="membership.titleBig" />
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            <T k="membership.sub" />
          </p>

          <div className="mt-5 space-y-3">
            {BASE_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`glass card-hover relative rounded-3xl p-6 ${
                  tier.featured ? "ring-2 ring-primary-500/60 shadow-xl shadow-primary-600/10" : ""
                }`}
              >
                {tier.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 px-3 py-1 text-[11px] font-bold text-white">
                    <T k="membership.mostPopular" />
                  </span>
                )}
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">
                  <T k="membership.level" vars={{ n: tier.level }} />
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  <T k={tier.nameKey} />
                </h3>
                <p className="mt-1 text-2xl font-black text-white">{formatMoney(tier.price)}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-zinc-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <T k={p} />
                    </li>
                  ))}
                </ul>
                <Link
                  href="/celebrities"
                  className={`mt-5 block rounded-full py-2.5 text-center text-sm font-semibold ${
                    tier.featured ? "btn-grad text-white" : "ring-1 ring-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  <T k="membership.chooseLevel" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] px-6 py-5 text-center">
            <p className="text-sm font-bold text-white">
              <T k="membership.signatureExperiences" />
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              <T k="membership.signatureSub" />
            </p>
          </div>
        </section>

        {/* ============ COUNTRIES ============ */}
        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-400">
            <T k="countries.section" />
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            <T k="countries.title" />
          </h2>
          <div className="mt-5 flex justify-center">
            <div className="glass rounded-2xl px-8 py-5 text-center">
              <p className="text-4xl font-black text-white">
                <CountUp value={representedCountries.length} />
              </p>
              <p className="text-xs font-medium text-zinc-500">
                <T k="countries.count" />
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {representedCountries.map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/[0.05] px-4 py-1.5 text-sm font-medium text-zinc-300 ring-1 ring-white/10"
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent-400">
            <T k="nav.faq" />
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            <T k="faq.title" />
          </h2>
          <div className="mt-5">
            <FaqSection />
          </div>
        </section>

        {/* ============ PRIVACY / TERMS / CONTACT ============ */}
        <section id="privacy" className="mt-10 border-t border-white/[0.06] pt-8">
          <div className="space-y-3">
            <div id="terms" className="glass rounded-2xl p-6">
              <h3 className="text-[15px] font-bold text-white">
                <T k="privacyBlock.privacy" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                <T k="privacyBlock.privacyBody" />
              </p>
            </div>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-[15px] font-bold text-white">
                <T k="privacyBlock.terms" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                <T k="privacyBlock.termsBody" />
              </p>
            </div>
            <div id="contact" className="glass rounded-2xl p-6">
              <h3 className="text-[15px] font-bold text-white">
                <T k="privacyBlock.contact" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                <T k="privacyBlock.contactBody" />
              </p>
              <a
                href="mailto:support@celebritypass.app"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-400 hover:text-primary-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
                support@celebritypass.app
              </a>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="mt-10">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/25 via-ink-800 to-ink-900 p-8 text-center">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/25 blur-[100px]" />
            <h2 className="relative text-2xl font-black tracking-tight sm:text-3xl">
              <T k="cta.title" />
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-zinc-300">
              <T k="cta.sub" />
            </p>
            <Link
              href="/celebrities"
              className="btn-grad relative mt-6 inline-block rounded-full px-8 py-3.5 text-base font-bold text-white"
            >
              <T k="cta.browse" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================= App-style sub-components ================= */

function EcoCard({
  href,
  title,
  sub,
  image,
  accent,
  gradient = false,
  icon,
}: {
  href: string;
  title: string;
  sub: string;
  image: string | null;
  accent: string;
  gradient?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex aspect-[4/4.6] flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.08] p-4 transition hover:border-white/[0.18]"
      style={{
        background: gradient
          ? `linear-gradient(150deg, ${accent}33 0%, rgba(5,6,10,0.9) 75%), #0b0c10`
          : undefined,
      }}
    >
      {image && !gradient ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 45vw, 280px"
          className="object-cover opacity-45 transition duration-500 group-hover:scale-105 group-hover:opacity-60"
          unoptimized
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/55 to-transparent" />
      <div className="relative flex items-center justify-between">
        <span
          className="grid h-10 w-10 place-items-center rounded-xl text-white"
          style={{ background: `${accent}cc` }}
        >
          {icon}
        </span>
        <svg className="h-5 w-5 text-zinc-400 transition group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
      <div className="relative">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-0.5 text-[12px] font-medium text-zinc-400">{sub}</p>
      </div>
    </Link>
  );
}

function OpportunityCard({
  href,
  title,
  desc,
  cta,
}: {
  href: string;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="glass card-hover group block rounded-3xl p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-black text-white">{title}</h3>
        <svg className="h-5 w-5 text-zinc-400 transition group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{desc}</p>
      <span className="mt-4 inline-block rounded-full bg-white/[0.06] px-4 py-2 text-[12px] font-bold text-white ring-1 ring-white/10 transition group-hover:bg-white/[0.1]">
        {cta}
      </span>
    </Link>
  );
}

function RailHeader({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: React.ReactNode;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary-400">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
      </div>
      <Link
        href={href}
        className="rounded-full px-4 py-2 text-[12px] font-bold text-zinc-300 ring-1 ring-white/10 transition hover:text-white"
      >
        See all
      </Link>
    </div>
  );
}

function Rail({ items }: { items: Array<ReturnType<typeof toCardCelebrity>> }) {
  return (
    <div className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {items.map((c) => (
        <Link
          key={c.id}
          href={`/celebrity/${c.slug}`}
          className="group w-[168px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] transition hover:border-white/[0.18]"
        >
          <div className="relative h-40 overflow-hidden">
            {c.coverImageUrl ? (
              <Image
                src={c.coverImageUrl}
                alt=""
                fill
                sizes="168px"
                className="object-cover transition duration-500 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="h-full w-full" style={{ background: `linear-gradient(100deg, ${c.accentColor}, #0b0c10)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="truncate text-[13px] font-bold text-white">{c.name}</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-300">{formatCount(c.fanCount)} fans</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}