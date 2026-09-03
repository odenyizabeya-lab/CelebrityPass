"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What is a fan card?",
    a: "A fan card is an official, digital membership card issued by a celebrity's fan community on CelebrityPass. Each card is unique to the fan who holds it and the community it belongs to, verified with a Fan ID and a QR code that links to a live card page.",
  },
  {
    q: "Is getting a fan card really free?",
    a: "Yes. Membership is currently free on every community — there are no payments or hidden fees on the platform today. Payment features will be introduced later, and any pricing will always be shown clearly before you confirm a purchase.",
  },
  {
    q: "Can I join more than one celebrity community?",
    a: "Absolutely. One account can hold many fan cards. Each community issues its own card with its own Fan ID, design, and membership level — the system always keeps your cards correctly attached to the right celebrity.",
  },
  {
    q: "How are fan counts and country numbers calculated?",
    a: "Every statistic on CelebrityPass is computed live from the database. A 'Fan' is a real registered member, and a country counts only once a real member from that country has an active card. When a community has no members yet, you'll see its honest starting state.",
  },
  {
    q: "What can I do with my card link?",
    a: "Your unique card link (e.g. /celebrity/name/fan/FC-000001) is a shareable, public verification page. Anyone who scans the QR code opens your fan card page and confirms your membership, level, and issuing date.",
  },
  {
    q: "What if my card is suspended or expired?",
    a: "A card can be marked Active, Suspended, or Expired by community administrators. A suspended card still exists but is flagged as non-active; a suspended account is not counted toward community statistics.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div id="faq" className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((faq, i) => (
        <div key={i} className="glass overflow-hidden rounded-2xl">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-white sm:text-base">{faq.q}</span>
            <svg
              className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${open === i ? "rotate-45" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{faq.a}</p>}
        </div>
      ))}
    </div>
  );
}