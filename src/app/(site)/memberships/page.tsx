import type { Metadata } from "next";
import Link from "next/link";
import { appUrl } from "@/lib/utils";

const BASE = appUrl();

export const metadata: Metadata = {
  title: "Celebrity Fan Cards & Official Fan Membership",
  description:
    "Learn how CelebrityPass fan cards work: a verified digital membership card for your favorite celebrity's official community, with your own unique Fan ID, membership level, and a shareable QR card page.",
  alternates: { canonical: `${BASE}/memberships` },
  openGraph: {
    type: "website",
    url: `${BASE}/memberships`,
    siteName: "CelebrityPass",
    title: "Celebrity Fan Cards & Official Fan Membership",
    description:
      "A verified digital fan card for every community you join — your own Fan ID, membership level, and a shareable QR card page.",
  },
  twitter: {
    card: "summary",
    title: "Celebrity Fan Cards & Official Fan Membership",
    description:
      "A verified digital fan card for every community you join — your own Fan ID, membership level, and a shareable QR card page.",
  },
};

export default function MembershipsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Fan Cards &amp; Membership</span>
      </nav>

      {/* Hero */}
      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Membership</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          Celebrity fan cards &amp; official fan{" "}
          <span className="gradient-text">membership</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-300">
          CelebrityPass issues digital fan cards for the official communities of artists, athletes,
          actors, creators, and public figures. One account can hold a card for every community
          you join — each with its own unique Fan ID, membership level, and a shareable card page.
        </p>
      </div>

      {/* What is a fan card */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">What is a fan card?</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          A fan card is an official digital membership card issued by a celebrity&apos;s fan community
          on CelebrityPass. It is unique to the fan who holds it and the community it belongs to. Your
          card carries your Fan ID and membership level, and it links to a live card page with a QR code
          that anyone can scan to verify your membership.
        </p>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          Fan cards are issued by CelebrityPass on behalf of each community. They identify your
          membership in that community and do not represent a contract with, or an endorsement by,
          the celebrity.
        </p>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">How membership works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            {
              n: "1",
              t: "Pick a community",
              d: "Browse the directory and open the page of any celebrity you follow. Every community has its own profile.",
            },
            {
              n: "2",
              t: "Register as a fan",
              d: "Enter your name, email, and country. A personal fan account is created for you.",
            },
            {
              n: "3",
              t: "Choose your membership level",
              d: "Free and paid levels are available. Every community shows its exact prices before you confirm anything.",
            },
            {
              n: "4",
              t: "Get and share your card",
              d: "Your official card is issued with a unique Fan ID, level, and a QR card page you can share anywhere.",
            },
          ].map((s) => (
            <div key={s.n} className="glass card-hover rounded-2xl p-5">
              <span className="gradient-text text-3xl font-black">{s.n}</span>
              <h3 className="mt-2 font-bold text-white">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's included */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white">What every fan card includes</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>✓</span>
            A unique, verified Fan ID that belongs to you and the community.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>✓</span>
            A live card link with a QR code that verifies your membership on any device.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>✓</span>
            Your membership level and community status, visible on your card page.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>✓</span>
            Fan-only community news and digital content shared by the community.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>✓</span>
            Higher levels can include exclusive card designs, recognition badges, and early access.
          </li>
        </ul>
      </section>

      {/* Honest transparency */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-white">What membership does not mean</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
          <li>A fan card is not a contract with, and does not imply endorsement by, the celebrity.</li>
          <li>Statistics shown on communities come directly from the database — we never invent follower or member counts.</li>
          <li>Paid levels are always priced transparently, and no charge is ever hidden.</li>
        </ul>
      </section>

      {/* CTA */}
      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Link href="/celebrities" className="btn-grad rounded-full px-7 py-3 text-sm font-bold text-white">
          Browse Celebrity Communities
        </Link>
        <Link href="/faq" className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5">
          Read the FAQ
        </Link>
        <Link href="/discovery" className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5">
          Explore Upcoming Events
        </Link>
      </div>

      {/* Related info */}
      <div className="mt-10 border-t border-white/10 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Related pages</h2>
        <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
          <Link href="/about" className="text-zinc-300 transition hover:text-white">About CelebrityPass →</Link>
          <Link href="/legal/payments" className="text-zinc-300 transition hover:text-white">Payments &amp; Refunds →</Link>
          <Link href="/help" className="text-zinc-300 transition hover:text-white">Help Center →</Link>
          <Link href="/legal/privacy" className="text-zinc-300 transition hover:text-white">Privacy Policy →</Link>
        </div>
      </div>
    </div>
  );
}