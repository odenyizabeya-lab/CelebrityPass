"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CelebritySummary } from "@/lib/services";
import CountUp from "./CountUp";
import VerifiedBadge from "./VerifiedBadge";

const CATEGORY_STYLES: Record<string, string> = {
  Musician: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30",
  Athlete: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  Actor: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  Artist: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  Creator: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  "Public Figure": "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

export default function CelebrityCard({ celebrity }: { celebrity: CelebritySummary }) {
  const router = useRouter();
  const catStyle = CATEGORY_STYLES[celebrity.category] ?? CATEGORY_STYLES["Public Figure"];
  const profileUrl = `/celebrity/${celebrity.slug}`;

  const openProfile = () => router.push(profileUrl);

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${celebrity.name} profile`}
      onClick={openProfile}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          openProfile();
        }
      }}
      className="card-hover glass group flex cursor-pointer flex-col overflow-hidden rounded-3xl"
    >
      {/* Cover */}
      <div className="relative h-44 overflow-hidden sm:h-52">
        {celebrity.coverImage ? (
          <Image
            src={celebrity.coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            className="h-full w-full transition duration-500 group-hover:scale-105"
            style={{ background: `linear-gradient(100deg, ${celebrity.accentColor}, #0b0c10)` }}
          />
        )}
      </div>

      {/* Avatar row */}
      <div className="flex items-start justify-between px-6 pt-3">
        <div className="relative z-10 -mt-14 w-40 sm:w-48">
          <div className="overflow-hidden rounded-2xl bg-ink-900 p-1.5 shadow-lg ring-4 ring-ink-900">
            {celebrity.profileImage ? (
              <Image
                src={celebrity.profileImage}
                alt={celebrity.name}
                width={144}
                height={180}
                className="h-auto w-full object-contain"
                unoptimized
              />
            ) : (
              <div
                className="grid aspect-[4/5] w-full place-items-center rounded-2xl text-3xl font-bold text-white"
                style={{ backgroundColor: celebrity.accentColor }}
              >
                {celebrity.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>
            )}
          </div>
        </div>
        <span className={`mt-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ${catStyle}`}>
          {celebrity.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        {/* Name + verified badge kept exactly as published */}
        <h3 className="flex items-center gap-1.5 text-lg font-bold leading-tight text-white group-hover:gradient-text">
          {celebrity.name}
          {celebrity.isVerified && <VerifiedBadge className="h-4 w-4" />}
        </h3>
        <p className="mt-1 text-base font-medium text-zinc-300">
          {celebrity.profession} · {celebrity.country}
        </p>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500">
          {celebrity.shortBio ?? celebrity.bio}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <div>
            <p className="text-xl font-black text-white">
              <CountUp value={celebrity.fanCount} />{" "}
              <span className="text-sm font-medium text-zinc-500">
                {celebrity.fanCount === 1 ? "Fan" : "Fans"}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {celebrity.countryCount} {celebrity.countryCount === 1 ? "country" : "countries"} · live
            </p>
          </div>
          <span className="rounded-full px-3.5 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 bg-emerald-500/10">
            Live community
          </span>
        </div>

        {/* Full-width action buttons, large touch targets */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href={profileUrl}
            onClick={(e) => e.stopPropagation()}
            className="btn-grad inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.46 12a10.3 10.3 0 0119.08 0 10.3 10.3 0 01-19.08 0z" />
            </svg>
            View Profile
          </Link>
          <Link
            href={`${profileUrl}/join`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/5 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-6 0M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Enter Community
          </Link>
        </div>
      </div>
    </div>
  );
}