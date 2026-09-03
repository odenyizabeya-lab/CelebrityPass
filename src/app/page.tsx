import Link from "next/link";
import CountUp from "@/components/CountUp";
import CelebrityCard from "@/components/CelebrityCard";
import HeroSearch from "@/components/HeroSearch";
import FaqSection from "@/components/FaqSection";
import { getCelebritySummaries, getPlatformStats } from "@/lib/services";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, celebrities] = await Promise.all([getPlatformStats(), getCelebritySummaries()]);

  const featured = celebrities.filter((c) => c.isFeatured).slice(0, 3);
  const popular = [...celebrities].sort((a, b) => b.fanCount - a.fanCount).slice(0, 4);

  const memberCountries = await prisma.fan.findMany({
    where: { isActive: true, country: { not: null } },
    select: { country: true },
    distinct: ["country"],
  });

  return (
    <div className="overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-zinc-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Multi-celebrity fan membership platform
          </span>
          <h1 className="fade-up mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            {`One account. `}
            <span className="gradient-text">Cards for every celebrity</span>
            {` you love.`}
          </h1>
          <p className="fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Join the official fan community of your favorite artists, athletes, actors, and creators. Get a verified
            digital fan card with your own Fan ID, membership level, and a shareable QR card page.
          </p>

          <HeroSearch />

          <div className="fade-up mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Communities", value: stats.celebrities },
              { label: "Verified Fans", value: stats.fans },
              { label: "Active Cards", value: stats.activeCards },
              { label: "Countries", value: stats.countries },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl px-4 py-4">
                <p className="text-2xl font-black text-white">
                  <CountUp value={s.value} />
                </p>
                <p className="mt-0.5 text-xs font-medium text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-widest text-zinc-600">
            Live statistics counted from real registrations only
          </p>
        </div>
      </section>

      {/* ============ FEATURED ============ */}
      {featured.length > 0 && (
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Featured</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Featured Communities</h2>
              </div>
              <Link
                href="/celebrities"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white sm:block"
              >
                Browse all →
              </Link>
            </div>
            {featured.length === 0 ? (
              <EmptyState message="Featured communities appear here once added." />
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">Trending</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Popular Fan Communities</h2>
            </div>
            <p className="hidden text-sm text-zinc-500 sm:block">Ranked by real member count</p>
          </div>
          {popular.length === 0 ? (
            <EmptyState message="Communities will be ranked here as members join." />
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Browse everything</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">All Celebrity Communities</h2>
            </div>
            <span className="hidden text-sm text-zinc-500 sm:block">Signed, sealed, scrolling</span>
          </div>
          {celebrities.length === 0 ? (
            <EmptyState message="Communities are added by the team — check back soon!" />
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">How it works</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">From fan to verified member in minutes</h2>
            <p className="mt-4 text-zinc-400">
              Choose a community, enter your details, and instantly receive an official fan card issued to you.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              {
                n: "01",
                t: "Pick a community",
                d: "Browse the directory and open the commit page of any celebrity that matters to you.",
              },
              {
                n: "02",
                t: "Register as a fan",
                d: "Enter your name, email, and country. A personal fan account is created for you.",
              },
              {
                n: "03",
                t: "Get your Fan ID",
                d: "A unique ID like FC-000001 is assigned to your card in that celebrity's community.",
              },
              {
                n: "04",
                t: "Share your card",
                d: "Your card page and QR code prove your membership anywhere, anytime.",
              },
            ].map((step, i) => (
              <div
                key={step.n}
                className="glass card-hover relative rounded-2xl p-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="gradient-text text-4xl font-black">{step.n}</span>
                <h3 className="mt-3 text-lg font-bold text-white">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MEMBERSHIP LEVELS ============ */}
      <section id="membership" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">Membership</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Levels that fit every fan</h2>
            <p className="mt-4 text-zinc-400">
              Every community defines its own tiers. Joining today is free — pricing arrives later and will always be
              transparent.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Member",
                tag: "Free forever",
                perks: ["Official digital fan card", "Unique verified Fan ID", "Live card link + QR", "Community access"],
                featured: false,
              },
              {
                name: "Gold",
                tag: "Rising soon",
                perks: ["Everything in Member", "Gold design tier", "Priority community news", "Special recognition badges"],
                featured: true,
              },
              {
                name: "VIP",
                tag: "Rising soon",
                perks: ["Everything in Gold", "Exclusive VIP design", "Premium support", "Top-tier community status"],
                featured: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`glass card-hover rounded-3xl p-7 ${
                  tier.featured ? "ring-2 ring-primary-500/60 shadow-xl shadow-primary-600/10" : ""
                }`}
              >
                {tier.featured && (
                  <span className="rounded-full bg-gradient-to-r from-primary-500 to-accent-500 px-3 py-1 text-[11px] font-bold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="mt-3 text-2xl font-black text-white">{tier.name}</h3>
                <p className="text-sm font-medium text-emerald-400">{tier.tag}</p>
                <ul className="mt-6 space-y-3">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/celebrities"
                  className={`mt-7 block rounded-full py-2.5 text-center text-sm font-semibold ${
                    tier.featured ? "btn-grad text-white" : "ring-1 ring-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  Find a community
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COUNTRIES ============ */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Worldwide</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Countries Represented</h2>
            <p className="mt-4 text-zinc-400">
              These countries are represented by real active members in our communities.
            </p>
          </div>

          {memberCountries.length === 0 ? (
            <div className="mx-auto mt-10 max-w-xl">
              <EmptyState message="No countries yet. The first registered fan introduces the first country." />
            </div>
          ) : (
            <>
              <div className="mx-auto mt-8 flex max-w-xl justify-center">
                <div className="glass rounded-2xl px-8 py-5 text-center">
                  <p className="text-4xl font-black text-white">
                    <CountUp value={memberCountries.length} />
                  </p>
                  <p className="text-xs font-medium text-zinc-500">countries with active members</p>
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400">FAQ</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </div>
          <FaqSection />
        </div>
      </section>

      {/* ============ PRIVACY / TERMS / CONTACT ============ */}
      <section id="privacy" className="border-t border-white/[0.06] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            <div id="terms" className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">Privacy</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                We store only what&apos;s needed to run your fan card: name, email, contact country, and your membership
                details. We never sell personal data, and we never publish your email. Fan card pages show your name and
                membership info by design.
              </p>
            </div>
            <div className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">Terms</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Fan cards identify your membership in a community. Accounts may be suspended if used for spam, fraud, or
                impersonation. Community administrators manage cards and statuses. Current membership is free; paid
                tiers, if introduced, will be opt-in.
              </p>
            </div>
            <div id="contact" className="glass rounded-2xl p-7">
              <h3 className="text-lg font-bold text-white">Contact</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Questions about a card, your account, or a community? Email us and we&apos;ll respond within 2 business days.
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
            Your favorite celebrity has a community.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-zinc-300">
            It takes under a minute to join. Your official fan card is issued instantly.
          </p>
          <Link
            href="/celebrities"
            className="btn-grad relative mt-8 inline-block rounded-full px-8 py-3.5 text-base font-bold text-white"
          >
            Browse Celebrity Communities
          </Link>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
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