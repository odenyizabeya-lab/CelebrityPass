"use client";

import { useMemo, useState } from "react";

type Faq = { q: string; a: string; topic: string };

const FAQS: Faq[] = [
  // Accounts & registration
  { topic: "Account & Registration", q: "How do I create an account?", a: "You can create an account by joining any celebrity community (choose a community and register as a fan), or by signing up directly from the Account Registration page. You'll provide your name, email, and choose a password." },
  { topic: "Account & Registration", q: "How do I log in?", a: "Go to the Fan Login page, enter your email and password, and sign in. A successful login shows your fan dashboard with your cards and communities." },
  { topic: "Account & Registration", q: "How do I change my password?", a: "Sign in, open Account Settings, and use the password section. You'll need to enter your current password to set a new one." },
  { topic: "Account & Registration", q: "I forgot my password. What do I do?", a: "Use the password reset link from the login page. Enter your email and, if an account exists, we'll send a reset link that's valid for one hour." },
  { topic: "Account & Registration", q: "Can one account join more than one community?", a: "Yes. One account can hold many fan cards, one per community, each with its own Fan ID and membership level." },
  { topic: "Account & Registration", q: "How do I delete my account?", a: "Sign in, open Account Settings, and use the delete option at the bottom. Deleting your account removes your account and associated fan cards. You can also submit a deletion request through the User Rights & Data Requests page." },

  // Fan cards
  { topic: "Fan Cards", q: "What is a fan card?", a: "A fan card is an official digital membership card issued by a celebrity's fan community. Each card is unique to the fan, with a Fan ID, membership level, and a shareable card page with a QR code." },
  { topic: "Fan Cards", q: "Is getting a fan card free?", a: "Membership on CelebrityPass is currently free on every community. Payment features will be introduced later, and any pricing will always be shown clearly before you confirm a purchase." },
  { topic: "Fan Cards", q: "How do I share my card?", a: "Your unique card link (for example /celebrity/name/fan/FC-000001) is a shareable public verification page. Anyone who scans the QR code can confirm your membership." },

  // Login & security
  { topic: "Login & Security", q: "Why was I asked to sign in again?", a: "For your protection, sessions can expire. To keep your account secure, log in again when prompted." },
  { topic: "Login & Security", q: "What should I do if my account is compromised?", a: "Contact support using the Security category on the Contact & Support page, and change your password as soon as possible." },

  // App
  { topic: "App", q: "How do I install the Android app?", a: "Download the CelebrityPass app for Android from the App Download page. The app uses the same account and shows the same platform on your phone." },
  { topic: "App", q: "Is my account the same on the app and website?", a: "Yes. The app and website share the same CelebrityPass account, so your cards and communities are consistent across both." },

  // Privacy
  { topic: "Privacy", q: "What information does CelebrityPass collect?", a: "We collect the information needed to run the service, such as your name, email, country, fan card details, and order/payment information. See our Privacy Policy for full details." },
  { topic: "Privacy", q: "Does CelebrityPass sell my data?", a: "No. We do not sell your personal data. We share information only as needed to run the service or where required by law." },
  { topic: "Privacy", q: "How do I request my data?", a: "Use the User Rights & Data Requests page to request access, correction, deletion, or export of your information." },

  // Events & tickets
  { topic: "Events & Tickets", q: "Where does event information come from?", a: "Event and ticket information is sourced from authorized providers and our team. We aim to keep it accurate, but event details can change." },
  { topic: "Events & Tickets", q: "When is a ticket issued?", a: "A ticket or card is only issued after a payment has genuinely succeeded or been verified. We never generate a ticket from an unconfirmed payment." },

  // Support
  { topic: "Support", q: "How do I contact support?", a: "Use the Contact & Support page to send us a message from the contact form and choose a category. We aim to respond within 2 business days." },
];

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set([]));

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? FAQS.filter((f) => (f.q + " " + f.a + " " + f.topic).toLowerCase().includes(q))
      : FAQS;
    const map = new Map<string, Faq[]>();
    for (const faq of filtered) {
      const arr = map.get(faq.topic) ?? [];
      arr.push(faq);
      map.set(faq.topic, arr);
    }
    return map;
  }, [query]);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const total = useMemo(() => FAQS.length, []);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          className="w-full rounded-2xl border border-white/10 bg-ink-800 py-4 pl-12 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {query.trim() ? `Showing results for "${query.trim()}"` : `${total} articles across the Help Center`}
      </p>

      {/* Results */}
      {grouped.size === 0 ? (
        <div className="glass mt-6 rounded-3xl px-6 py-14 text-center">
          <h3 className="text-lg font-bold text-white">No results found</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            We couldn&apos;t find an article matching your search. Try different keywords, or contact our{" "}
            <a href="/legal/contact" className="text-primary-400 underline">support team</a>.
          </p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([topic, faqs]) => (
          <section key={topic} className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{topic}</h2>
            <div className="mt-3 space-y-3">
              {faqs.map((faq) => {
                const key = `${topic}:${faq.q}`;
                const isOpen = open.has(key);
                return (
                  <div key={key} className="glass overflow-hidden rounded-2xl">
                    <button
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-white sm:text-base">{faq.q}</span>
                      <svg
                        className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-45" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {isOpen && (
                      <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{faq.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
