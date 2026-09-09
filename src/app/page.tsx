import Link from "next/link";
import CountUp from "@/components/CountUp";
import CelebrityCard from "@/components/CelebrityCard";
import HeroSearch from "@/components/HeroSearch";
import FaqSection from "@/components/FaqSection";
import T from "@/components/T";
import { getCelebritySummaries, getPlatformStats } from "@/lib/services";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/payments";

export const revalidate = 60;

// Global base membership: LEVEL 1 = Premium $1,000, LEVEL 2 = VIP $1,700 (USD).
const PREMIUM_PRICE = 1000;
const VIP_PRICE = 1700;

export default async function HomePage() {
  const [stats, celebrities] = await Promise.all([getPlatformStats(), getCelebritySummaries()]);

  const featured = celebrities.filter((c) => c.isFeatured).slice(0, 3);
  const popular = [...celebrities].sort((a, b) => b.fanCount - a.fanCount).slice(0, 4);

  const memberCountryGroups = await prisma.fan.groupBy({
    where: { isActive: true, country: { not: null } },
    by: ["country"],
    _count: { _all: true },
  });
  const memberCountries = memberCountryGroups.map((g) => ({ country: g.country ?? "" }));

  return (
    <div className="overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-zinc-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <T k="hero.badge" />
          </span>
          <h1 className="fade-up mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <T k="hero.titleA" />
            <span className="gradient-text">
              <T k="hero.titleHighlight" />
            </span>
            <T k="hero.titleB" />
          </h1>
          <p className="fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            <T k="hero.sub" />
          </p>

          <HeroSearch />

          <div className="fade-up mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: "hero.statsCommunities", value: stats.celebrities },
              { key: "hero.statsVerifiedFans", value: stats.fans },
              { key: "hero.statsActiveCards", value: stats.activeCards },
              { key: "hero.statsCountries", value: stats.countries },
            ].map((s) => (
              <div key={s.key} className="glass rounded-2xl px-4 py-4">
                <p className="text-2xl font-black text-white">
                  <CountUp value={s.value} />
                </p>
                <p className="mt-0.5 text-xs font-medium text-zinc-500">
                  <T k={s.key} />
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-widest text-zinc-600">
            <T k="hero.statsLiveNote" />
          </p>
        </div>
      </section>

      {/* ============ FEATURED ============ */}
      {featured.length > 0 && (
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
                  <T k="home.featured" />
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  <T k="home.featuredCommunities" />
                </h2>
              </div>
              <Link
                href="/celebrities"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white sm:block"
              >
                <T k="home.browseAll" />
              </Link>
            </div>
            {featured.length === 0 ? (
              <EmptyState message={<T k="common.noResults" />} />
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((c) => (
                  <CelebrityCard key={c.id} celebrity={c} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ POPULAR ============ */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">
                <T k="home.trending" />
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                <T k="home.popularCommunities" />
              </h2>
            </div>
            <p className="hidden text-sm text-zinc-500 sm:block">
              <T k="home.rankedBy" />
            </p>
          </div>
          {popular.length === 0 ? (
            <EmptyState message={<T k="common.noResults" />} />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((c) => (
                <CelebrityCard key={c.id} celebrity={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ ALL CELEBRITIES ============ */}
      <section id="all-communities" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
                <T k="home.browseEverything" />
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                <T k="home.allCommunities" />
              </h2>
            </div>
            <span className="hidden text-sm text-zinc-500 sm:block">
              <T k="home.sealed" />
            </span>
          </div>
          {celebrities.length === 0 ? (
            <EmptyState message={<T k="common.noResults" />} />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {celebrities.map((c) => (
                <CelebrityCard key={c.id} celebrity={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
              <T k="home.howItWorks" />
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              <T k="home.howItWorksTitle" />
            </h2>
            <p className="mt-4 text-zinc-400">
              <T k="home.howItWorksSub" />
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "home.step1T", d: "home.step1D" },
              { n: "02", t: "home.step2T", d: "home.step2D" },
              { n: "03", t: "home.step3T", d: "home.step3D" },
              { n: "04", t: "home.step4T", d: "home.step4D" },
            ].map((step, i) => (
              <div
                key={step.n}
                className="glass card-hover relative rounded-2xl p-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="gradient-text text-4xl font-black">{step.n}</span>
                <h3 className="mt-3 text-lg font-bold text-white">
                  <T k={step.t} />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  <T k={step.d} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MEMBERSHIP LEVELS ============ */}
      <section id="membership" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">
              <T k="membership.title" />
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              <T k="membership.titleBig" />
            </h2>
            <p className="mt-4 text-zinc-400">
              <T k="membership.sub" />
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                id: "premium",
                name: <T k="membership.premiumName" />,
                level: <T k="membership.level" vars={{ n: 1 }} />,
                price: formatMoney(PREMIUM_PRICE),
                perks: [
                  "membership.premiumPerk1",
                  "membership.premiumPerk2",
                  "membership.premiumPerk3",
                  "membership.premiumPerk4",
                  "membership.premiumPerk5",
                ],
                featured: false,
              },
              {
                id: "vip",
                name: <T k="membership.vipName" />,
                level: <T k="membership.level" vars={{ n: 2 }} />,
                price: formatMoney(VIP_PRICE),
                perks: [
                  "membership.vipPerk1",
                  "membership.vipPerk2",
                  "membership.vipPerk3",
                  "membership.vipPerk4",
                  "membership.vipPerk5",
                ],
                featured: true,
              },
            ].map((tier) => (
              <div
                key={tier.id}
                className={`glass card-hover relative rounded-3xl p-8 ${
                  tier.featured ? "ring-2 ring-primary-500/60 shadow-xl shadow-primary-600/10" : ""
                }`}
              >
                {tier.featured && (
                  <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 px-3 py-1 text-[11px] font-bold text-white">
                    <T k="membership.mostPopular" />
                  </span>
                )}
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">{tier.level}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{tier.name}</h3>
                <p className="mt-2 text-3xl font-black text-white">{tier.price}</p>
                <ul className="mt-6 space-y-3">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <T k={p} />
                    </li>
                  ))}
                </ul>
                <Link
                  href="/celebrities"
                  className={`mt-7 block rounded-full py-2.5 text-center text-sm font-semibold ${
                    tier.featured ? "btn-grad text-white" : "ring-1 ring-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  <T k="membership.chooseLevel" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] px-6 py-5 text-center">
            <p className="text-sm font-bold text-white">
              <T k="membership.signatureExperiences" />
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              <T k="membership.signatureSub" />
            </p>
          </div>
        </div>
      </section>

      {/* ============ COUNTRIES ============ */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
              <T k="countries.section" />
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              <T k="countries.title" />
            </h2>
            <p className="mt-4 text-zinc-400">
              <T k="countries.sub" />
            </p>
          </div>

          {memberCountries.length === 0 ? (
            <div className="mx-auto mt-10 max-w-xl">
              <EmptyState message={<T k="countries.empty" />} />
            </div>
          ) : (
            <>
              <div className="mx-auto mt-8 flex max-w-xl justify-center">
                <div className="glass rounded-2xl px-8 py-5 text-center">
                  <p className="text-4xl font-black text-white">
                    <CountUp value={memberCountries.length} />
                  </p>
                  <p className="text-xs font-medium text-zinc-500">
                    <T k="countries.count" />
                  </p>
                </div>
              </div>
              <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
                {memberCountries.map((c) => (
                  <span
                    key={c.country}
                    className="rounded-full bg-white/[0.05] px-4 py-1.5 text-sm font-medium text-zinc-300 ring-1 ring-white/10"
                  >
                    {c.country}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">
              <T k="nav.faq" />
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              <T k="faq.title" />
            </h2>
          </div>
          <FaqSection />
        </div>
      </section>

      {/* ============ PRIVACY / TERMS / CONTACT ============ */}
      <section id="privacy" className="border-t border-white/[0.06] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            <div id="terms" className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">
                <T k="privacyBlock.privacy" />
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                <T k="privacyBlock.privacyBody" />
              </p>
            </div>
            <div className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">
                <T k="privacyBlock.terms" />
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                <T k="privacyBlock.termsBody" />
              </p>
            </div>
            <div id="contact" className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">
                <T k="privacyBlock.contact" />
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
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
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/25 via-ink-800 to-ink-900 p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/25 blur-[100px]" />
          <h2 className="relative text-3xl font-black tracking-tight sm:text-5xl">
            <T k="cta.title" />
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-zinc-300">
            <T k="cta.sub" />
          </p>
          <Link
            href="/celebrities"
            className="btn-grad relative mt-8 inline-block rounded-full px-8 py-3.5 text-base font-bold text-white"
          >
            <T k="cta.browse" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: React.ReactNode }) {
  return (
    <div className="glass mt-8 rounded-2xl border-dashed px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.05]">
        <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="mt-4 text-sm text-zinc-400">{message}</p>
    </div>
  );
}