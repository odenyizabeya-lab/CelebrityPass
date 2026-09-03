import Link from "next/link";

/** Consistent layout + navigation for CelebrityPass legal / information pages. */
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy" className="transition hover:text-white">
          Privacy
        </Link>
        <Link href="/legal/terms" className="transition hover:text-white">
          Terms
        </Link>
        <Link href="/legal/payments" className="transition hover:text-white">
          Payments &amp; Refunds
        </Link>
        <Link href="/legal/contact" className="transition hover:text-white">
          Contact
        </Link>
      </nav>

      <div className="glass mt-8 rounded-3xl p-7 sm:p-10">
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">Last updated: {updated}</p>
        <div className="prose-cp mt-6 space-y-5 text-sm leading-relaxed text-zinc-300">{children}</div>
      </div>
    </div>
  );
}