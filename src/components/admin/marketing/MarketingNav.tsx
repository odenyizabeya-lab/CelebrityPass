"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/marketing/overview", label: "Overview" },
  { href: "/admin/marketing/platforms", label: "Platforms" },
  { href: "/admin/marketing/accounts", label: "Accounts" },
  { href: "/admin/marketing/automatic", label: "Automatic" },
  { href: "/admin/marketing/manual", label: "Manual" },
  { href: "/admin/marketing/schedule", label: "Schedule" },
  { href: "/admin/marketing/queue", label: "Queue" },
  { href: "/admin/marketing/posts", label: "Posts" },
  { href: "/admin/marketing/failed", label: "Failed" },
  { href: "/admin/marketing/logs", label: "Logs" },
  { href: "/admin/marketing/articles", label: "Articles" },
  { href: "/admin/marketing/api-status", label: "API Status" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-4">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40" : "text-zinc-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}