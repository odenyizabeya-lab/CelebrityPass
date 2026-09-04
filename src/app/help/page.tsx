import type { Metadata } from "next";
import Link from "next/link";
import HelpCenter from "@/components/help/HelpCenter";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Searchable help and frequently asked questions about CelebrityPass accounts, login, app installation, privacy, and more.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Help Center</span>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Help Center</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">How can we help?</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Search for answers about accounts, login, the app, privacy, and more. Can&apos;t find what you need?{" "}
          <Link href="/legal/contact" className="text-primary-400 underline">Contact support</Link>.
        </p>
      </div>

      <div className="mt-8">
        <HelpCenter />
      </div>
    </div>
  );
}
