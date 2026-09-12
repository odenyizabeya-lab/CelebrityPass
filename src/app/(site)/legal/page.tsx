import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal & Support",
  description:
    "All CelebrityPass legal, privacy, security, and support resources in one place: FAQ, Privacy Policy, Terms of Service, Payments & Refunds, Security & Trust, User Rights, Help Center, and Contact & Support.",
  alternates: { canonical: "/legal" },
};

const SECTIONS = [
  {
    href: "/faq",
    title: "FAQ",
    body: "Quick answers about accounts, fan cards, payments, refunds, privacy, events, and support.",
  },
  {
    href: "/help",
    title: "Help Center",
    body: "A searchable library with every help article across all topics, plus next steps when you need more.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    body: "How CelebrityPass collects, uses, stores, and protects your personal data. Publicly accessible to everyone.",
  },
  {
    href: "/legal/terms",
    title: "Terms of Service",
    body: "The terms that govern your access to and use of the CelebrityPass platform, including acceptable use and payment terms.",
  },
  {
    href: "/legal/payments",
    title: "Payments & Refunds",
    body: "How Bank Transfer and ATM Card payments work, manual verification, and our refund policy.",
  },
  {
    href: "/security",
    title: "Security & Trust",
    body: "The security measures CelebrityPass actually implements, what we do not claim, and how to report a concern.",
  },
  {
    href: "/legal/rights",
    title: "User Rights & Data Requests",
    body: "Request access to, correction of, export of, or deletion of your personal data, without needing to sign in.",
  },
  {
    href: "/legal/contact",
    title: "Contact & Support",
    body: "Reach the support team directly, choose a category, and get a response within 2 business days.",
  },
  {
    href: "/about",
    title: "About CelebrityPass",
    body: "What the platform is, how fan communities and verified fan cards work, and how we keep statistics honest.",
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Legal &amp; Support</span>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Legal &amp; Support</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Every policy, right, and way to get help</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Everything you need to know about using CelebrityPass — our policies, your rights, payments &amp; refunds,
          security, and how to reach us. Pick a section below.
        </p>
      </div>

      {/* Account data & deletion — highlighted for easy discovery */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Account data</p>
        <h2 className="mt-2 text-xl font-bold text-white">Delete your CelebrityPass account or get your data</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-300">
          You can delete your CelebrityPass account and its associated data in two ways:{" "}
          <strong>in the app</strong> (sign in, open Account Settings, and use the delete option), or{" "}
          <strong>on the web</strong> without signing in via the{" "}
          <Link href="/legal/rights" className="text-primary-400 underline">User Rights &amp; Data Requests</Link> page.
          You can also request access to, correction of, or export of your data from the same page.
        </p>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="glass card-hover group rounded-2xl p-5 transition"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">{s.title}</h3>
              <svg
                className="h-4 w-4 text-zinc-500 transition group-hover:text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.body}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-bold text-white">Can&apos;t find an answer?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-300">
          Email us at{" "}
          <a href="mailto:support@celebritypass.app" className="text-primary-400 underline">
            support@celebritypass.app
          </a>{" "}
          or use the{" "}
          <Link href="/legal/contact" className="text-primary-400 underline">Contact &amp; Support</Link> page — we aim
          to respond within 2 business days.
        </p>
      </section>
    </div>
  );
}