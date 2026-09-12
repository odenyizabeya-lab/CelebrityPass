import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About CelebrityPass",
  description:
    "Learn what CelebrityPass is, what it offers, who it's for, and what it does — and does not — provide.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">About</span>
      </nav>

      {/* Hero */}
      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">About</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Celebrity<span className="gradient-text">Pass</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-300">
          CelebrityPass is an entertainment platform for legitimate celebrity fan cards, event tickets, concerts,
          shows, VIP experiences, and meet-and-greet experiences. One account, official verified fan cards, and real
          ticketed events.
        </p>
      </div>

      {/* What it is */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">What CelebrityPass is</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          CelebrityPass brings fans and the official fan communities of their favorite artists, athletes, actors,
          creators, and public figures together in one place. You create one account that can hold a digital fan card
          for every community you join, each with its own unique Fan ID, membership level, and a shareable card page
          with a QR code.
        </p>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          Alongside fan communities, CelebrityPass includes tools for exploring publicly announced events and, where
          an authorized ticket provider lists availability, for purchasing event tickets through an approved payment
          and fulfillment process.
        </p>
      </section>

      {/* Purpose */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Our purpose</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          We want fans to be able to show their support in an organized, verifiable way — a real digital membership
          card they can share, keep, and look back on. We also want events and ticketing to be transparent: tickets
          are only ever issued after a payment has genuinely succeeded, and all publicly listed statistics come
          directly from the database.
        </p>
      </section>

      {/* Services */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Services available today</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card icon="🪪" title="Official fan cards" body="A unique, verified digital fan card with your own Fan ID and QR code for every community you join." />
          <Card icon="🎫" title="Event discovery" body="Browse publicly announced events for your favorite communities, with status and timing information." />
          <Card icon="🛒" title="Ticket purchasing" body="Where an authorized source lists ticket availability, buy through an approved payment and fulfillment flow." />
          <Card icon="📱" title="Android app" body="The CelebrityPass Android app brings the same platform to your phone, using the same account." />
        </div>
      </section>

      {/* Intended users */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Who CelebrityPass is for</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          CelebrityPass is for fans of celebrities and public figures — including musicians, athletes, actors,
          creators, and artists — who want a genuine, shareable way to be part of an official fan community. It is
          also designed for community administrators who manage fan cards, memberships, events, and orders.
        </p>
      </section>

      {/* Mission & values */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-white">Mission and values</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 leading-relaxed text-zinc-300">
          <li><strong className="text-white">Honesty over hype.</strong> We display only real, database-verified statistics and never fabricate data.</li>
          <li><strong className="text-white">Transparency.</strong> Our policies, contact paths, and what we do with your data are explained openly on this site.</li>
          <li><strong className="text-white">Provenance.</strong> Event and ticket information is sourced from authorized providers, never invented.</li>
          <li><strong className="text-white">Security by default.</strong> Accounts are hashed, sessions are signed, and admin tools are password- and 2FA-protected.</li>
        </ul>
      </section>

      {/* What we do NOT provide */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-bold text-white">What CelebrityPass does not provide</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
          <li>It is not an official merchandise store for any celebrity.</li>
          <li>Fan cards and memberships are not contracts with, and do not imply endorsement by, any celebrity.</li>
          <li>We do not guarantee ticket availability for events; availability comes only from authorized sources.</li>
          <li>We do not sell, rent, or trade your personal data.</li>
        </ul>
      </section>

      {/* How to go next */}
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/celebrities" className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white">
          Browse Communities
        </Link>
        <Link href="/legal/privacy" className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5">
          Read our Privacy Policy
        </Link>
        <Link href="/legal/contact" className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5">
          Contact &amp; Support
        </Link>
      </div>
    </div>
  );
}

function Card({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="glass card-hover rounded-2xl p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-600/30 to-accent-500/30 text-xl ring-1 ring-white/10">
        {icon}
      </div>
      <h3 className="mt-3 font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}
