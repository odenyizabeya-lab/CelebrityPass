"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/overview", label: "Home", icon: <HomeIcon /> },
  { href: "/admin/celebrities", label: "Celebrities", icon: <UsersIcon /> },
  { href: "/admin/events", label: "Events", icon: <CalendarIcon /> },
  { href: "/admin/tickets", label: "Tickets", icon: <TicketIcon /> },
  { href: "/admin/payments", label: "Payments", icon: <CardIcon /> },
];

/**
 * Mobile bottom tab bar (Android-app style): the primary admin sections are
 * always one thumb-tap away, links are prefetched so switching is instant.
 */
export default function AdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/") ||
            (tab.href === "/admin/overview" && (pathname === "/admin" || pathname === "/admin/overview"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition active:scale-95 ${
                active ? "text-primary-300" : "text-zinc-500"
              }`}
            >
              <span className="pointer-events-none">{tab.icon}</span>
              <span className="pointer-events-none leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.95-8.95a1.1 1.1 0 0 1 1.6 0L21.75 12M4.5 9.75V21a.75.75 0 0 0 .75.75h4.5V15a1.5 1.5 0 0 1 3 0v6.75h4.5a.75.75 0 0 0 .75-.75V9.75" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.13a3.38 3.38 0 0 0-2.62-1.26h-4.01A3.38 3.38 0 0 0 5.75 21.13M14.25 6.56a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8Zm5.5 8.94a3.38 3.38 0 0 0-2.38-3.22M17.25 13a3.63 3.63 0 1 0 0-7.25 3.63 3.63 0 0 0 0 7.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21.13a3.38 3.38 0 0 1 3.38-3.38h4.01a3.38 3.38 0 0 1 3.38 3.38M12 4.76a2.9 2.9 0 1 1-5.8 0 2.9 2.9 0 0 1 5.8 0Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.62 0-1.125.5-1.125 1.12v3.32c0 .59.45 1.07 1.03 1.13a2.25 2.25 0 0 1 0 4.47c-.58.06-1.03.54-1.03 1.13v3.32c0 .62.5 1.12 1.12 1.12h17.25c.62 0 1.12-.5 1.12-1.12v-3.32c0-.59-.45-1.07-1.02-1.13a2.25 2.25 0 0 1 0-4.47c.57-.06 1.03-.54 1.03-1.13V6.37c0-.62-.5-1.12-1.13-1.12H3.375Z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  );
}