"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "home", label: "Home", href: "/invest", icon: "home" },
  { key: "markets", label: "Markets", href: "/invest/markets", icon: "markets" },
  { key: "invest", label: "Stocks", href: "/invest/markets/TSLA", icon: "invest" },
  { key: "portfolio", label: "Portfolio", href: "/invest/portfolio", icon: "portfolio" },
  { key: "news", label: "News", href: "/invest/news", icon: "news" },
] as const;

function Icon({ name, active }: { name: string; active: boolean }) {
  const cls = `h-[22px] w-[22px] ${active ? "text-purple-400" : "text-zinc-500"}`;
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9 };
  switch (name) {
    case "home":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-6v-7h-4v7H4a1 1 0 01-1-1z" />
        </svg>
      );
    case "markets":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m5 10V4m5 16v-8m5 8V7" />
        </svg>
      );
    case "invest":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a4 4 0 014 4h-2a2 2 0 10-4 0c0 .7.4 1.2 1 1.6l.3.2c1.8 1.1 2.7 2.7 2.7 4.6a4 4 0 01-4 4v2h-1v-2a4 4 0 01-4-4h2a2 2 0 104 0c0-.7-.4-1.2-1-1.6l-.3-.2c-1.8-1.1-2.7-2.7-2.7-4.6A4 4 0 0112 2z" />
        </svg>
      );
    case "portfolio":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 01-9-9M12 21a9 9 0 009-9M12 21v-9M21 12H3m5-6a9 9 0 015-1m5 1a9 9 0 015 6" />
        </svg>
      );
    default:
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h13a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zM19 9h2a1 1 0 011 1v8a2 2 0 01-4 0V6M7 9h6m-6 4h6m-6 4h4" />
        </svg>
      );
  }
}

export function BottomNav() {
  const path = usePathname();

  function isActive(key: string): boolean {
    switch (key) {
      case "home":
        // Outside the invest app (e.g. the investible celebrity profile pages
        // that embed the Home) Home stays the selected tab.
        return path === "/invest" || path === "/invest/search" || !path.startsWith("/invest");
      case "markets":
        return path === "/invest/markets";
      case "invest":
        return path.startsWith("/invest/markets/");
      case "portfolio":
        return path.startsWith("/invest/portfolio");
      default:
        return path.startsWith("/invest/news");
    }
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-[#05060a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      aria-label="Primary"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-5">
        {ITEMS.map((it) => {
          const active = isActive(it.key);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-bold transition ${
                active ? "text-purple-300" : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <span
                className={`grid h-8 w-14 place-items-center rounded-full transition ${
                  active ? "bg-purple-500/15" : "group-active:bg-white/[0.06]"
                }`}
              >
                <Icon name={it.icon} active={active} />
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}