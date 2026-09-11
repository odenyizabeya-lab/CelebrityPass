"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FAQS } from "@/lib/faqs";

export default function FaqList() {
  const [open, setOpen] = useState<Set<string>>(new Set([]));

  const grouped = useMemo(() => {
    const map = new Map<string, { q: string; a: string }[]>();
    for (const faq of FAQS) {
      const arr = map.get(faq.topic) ?? [];
      arr.push({ q: faq.q, a: faq.a });
      map.set(faq.topic, arr);
    }
    return map;
  }, []);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      {Array.from(grouped.entries()).map(([topic, faqs]) => (
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
      ))}

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <h3 className="text-lg font-bold text-white">Still need help?</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Search all articles in the {" "}
          <Link href="/help" className="text-primary-400 underline">Help Center</Link>, or{" "}
          <Link href="/legal/contact" className="text-primary-400 underline">contact our support team</Link>.
        </p>
      </div>
    </div>
  );
}