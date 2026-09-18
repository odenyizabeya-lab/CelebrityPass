"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function BrandMark() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="cp-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path
        d="M5 12a7 7 0 0 1 7-7c2.9 0 5.4 1.8 6.5 4.3a3 3 0 1 1 0 5.4A7 7 0 0 1 5 12z"
        fill="url(#cp-brand)"
      />
      <circle cx="12" cy="12" r="2.2" fill="#fff" />
    </svg>
  );
}

export function AppHeader({ showBack = true, onBack }: { showBack?: boolean; onBack?: () => void }) {
  const { back } = useRouter();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#05060a]/90 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2.5">
        {showBack && (
          <button
            aria-label="Back"
            onClick={() => (onBack ? onBack() : back())}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark />
          <span className="truncate text-[15px] font-extrabold tracking-tight">
            <span className="text-white">Celebrity</span>
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Pass</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/invest/search"
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-full text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
        </Link>
        <Link
          href="/invest/news"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </Link>
        <Link
          href="/account"
          aria-label="Profile"
          className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[11px] font-black text-white ring-2 ring-white/10"
        >
          CP
        </Link>
      </div>
    </header>
  );
}