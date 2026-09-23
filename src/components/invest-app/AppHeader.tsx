"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ${
      small ? "h-8 w-8" : "h-10 w-10"
    } bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-900/40`}>
      <svg className={small ? "h-4 w-4" : "h-5 w-5"} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12a7 7 0 0 1 7-7c2.9 0 5.4 1.8 6.5 4.3a3 3 0 1 1 0 5.4A7 7 0 0 1 5 12z"
          fill="#fff"
        />
        <circle cx="12" cy="12" r="2.2" fill="#a855f7" />
      </svg>
    </span>
  );
}

/**
 * Native-app top bar. Shows the brand + optional page title, back affordance,
 * and a compact action cluster (search / feed / account). Bigger touch targets
 * than a classic web header.
 */
export function AppHeader({
  showBack = true,
  title,
  onBack,
}: {
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
}) {
  const { back } = useRouter();
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05060a]/92 px-3 py-2.5 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {showBack && (
            <button
              aria-label="Back"
              onClick={() => (onBack ? onBack() : back())}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-zinc-200 ring-1 ring-white/[0.07] transition active:scale-95 active:bg-white/[0.1]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <BrandMark small={!showBack} />
          {title ? (
            <h1 className="truncate text-[17px] font-extrabold tracking-tight text-white">{title}</h1>
          ) : (
            <span className="ml-0.5 truncate text-[16px] font-extrabold tracking-tight">
              <span className="text-white">Celebrity</span>
              <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Pass</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/invest/search"
            aria-label="Search securities"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.05] text-zinc-200 ring-1 ring-white/[0.07] transition active:scale-95 active:bg-white/[0.1]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
          </Link>
          <Link
            href="/invest/news"
            aria-label="Market news"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.05] text-zinc-200 ring-1 ring-white/[0.07] transition active:scale-95 active:bg-white/[0.1]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </Link>
          <Link
            href="/account"
            aria-label="Account and security"
            className="grid h-11 w-11 place-items-center active:scale-95"
          >
            <BrandMark small />
          </Link>
        </div>
      </div>
    </header>
  );
}