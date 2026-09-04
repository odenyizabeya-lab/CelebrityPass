import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-600 to-accent-500 text-xs font-black text-white">
              CP
            </span>
            <span className="text-lg font-bold tracking-tight">
              Celebrity<span className="gradient-text">Pass</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
            CelebrityPass is an entertainment platform for legitimate celebrity fan cards, event tickets, concerts,
            shows, VIP experiences, and meet-and-greet experiences. One account, official verified fan cards, and real
            ticketed events.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Explore</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/" className="transition hover:text-white">Home</Link></li>
            <li><Link href="/about" className="transition hover:text-white">About CelebrityPass</Link></li>
            <li><Link href="/celebrities" className="transition hover:text-white">Celebrity Directory</Link></li>
            <li><Link href="/discovery" className="transition hover:text-white">Event Discovery</Link></li>
            <li><Link href="/#how-it-works" className="transition hover:text-white">How It Works</Link></li>
            <li><Link href="/#membership" className="transition hover:text-white">Membership Levels</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Account</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/dashboard" className="transition hover:text-white">Fan Dashboard</Link></li>
            <li><Link href="/account" className="transition hover:text-white">Account Settings</Link></li>
            <li><Link href="/login" className="transition hover:text-white">Log In</Link></li>
            <li><Link href="/register" className="transition hover:text-white">Register</Link></li>
            <li><Link href="/download" className="transition hover:text-white">App Download</Link></li>
            <li><Link href="/#faq" className="transition hover:text-white">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Legal &amp; Support</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/legal/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/legal/terms" className="transition hover:text-white">Terms of Service</Link></li>
            <li><Link href="/legal/payments" className="transition hover:text-white">Payments &amp; Refunds</Link></li>
            <li><Link href="/security" className="transition hover:text-white">Security &amp; Trust</Link></li>
            <li><Link href="/legal/rights" className="transition hover:text-white">User Rights &amp; Data Requests</Link></li>
            <li><Link href="/help" className="transition hover:text-white">Help Center</Link></li>
            <li><Link href="/legal/contact" className="transition hover:text-white">Contact &amp; Support</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} CelebrityPass. All rights reserved.</p>
          <p>Each celebrity community displays only real, database-verified member statistics.</p>
        </div>
      </div>
    </footer>
  );
}
