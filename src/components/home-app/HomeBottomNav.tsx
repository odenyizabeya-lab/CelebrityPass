"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "discover", label: "Discover", href: "/discovery", icon: "discover" },
  { key: "communities", label: "Communities", href: "/celebrities", icon: "communities" },
  { key: "opportunities", label: "Opportunities", href: "/invest", icon: "opportunities" },
  { key: "profile", label: "Profile", href: "/account", icon: "profile" },
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
    case "discover":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5L14 14l-5.5 1.5L10 10l5.5-1.5z" />
        </svg>
      );
    case "communities":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M14 20H3v-2a4 4 0 014-4h1a4 4 0 013.5 2.13M15 7a3 3 0 11-6 0 3 3 0 016 0zm5 1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      );
    case "opportunities":
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m5 10V4m5 16v-8m5 8V7M3 20h18" />
        </svg>
      );
    default:
      return (
        <svg className={cls} {...s} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0 17.9 17.9 0 01-7.5 1.65 17.9 17.9 0 01-7.5-1.65z" />
        </svg>
      );
  }
}

export function HomeBottomNav() {
  const path = usePathname();

  function isActive(key: string): boolean {
    switch (key) {
      case "home":
        return path === "/";
      case "discover":
        return path.startsWith("/discovery");
      case "communities":
        return path === "/celebrities" || path.startsWith("/celebrity/");
      case "opportunities":
        return path.startsWith("/invest");
      default:
        return path === "/account" || path === "/dashboard";
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