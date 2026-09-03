import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 text-xs font-black text-white shadow-lg shadow-primary-600/30 ring-1 ring-white/20">
            CP
          </span>
          <span className="text-lg font-bold tracking-tight">
            Celebrity<span className="gradient-text">Pass</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-zinc-300 md:flex">
          <Link href="/celebrities" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
            Celebrities
          </Link>
          <Link href="/#how-it-works" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
            How It Works
          </Link>
          <Link href="/#membership" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
            Membership
          </Link>
          <Link href="/#faq" className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5 sm:block"
          >
            My Cards
          </Link>
          <Link
            href="/celebrities"
            className="btn-grad rounded-full px-4 py-2 text-sm font-semibold text-white"
          >
            Find Your Fan Card
          </Link>
        </div>
      </div>
    </header>
  );
}