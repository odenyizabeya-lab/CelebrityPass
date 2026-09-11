import type { Metadata } from "next";
import Link from "next/link";
import FaqList from "@/components/help/FaqList";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about CelebrityPass accounts, fan cards, payments, refunds, privacy, events, and support.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <Link href="/legal" className="transition hover:text-white">Legal &amp; Support</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">FAQ</span>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">FAQ</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Frequently asked questions</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Quick answers about accounts, fan cards, payments &amp; refunds, privacy, events, and support. Can&apos;t
          find what you need? <Link href="/help" className="text-primary-400 underline">Search the Help Center</Link> or{" "}
          <Link href="/legal/contact" className="text-primary-400 underline">contact support</Link>.
        </p>
      </div>

      <div className="mt-8">
        <FaqList />
      </div>
    </div>
  );
}