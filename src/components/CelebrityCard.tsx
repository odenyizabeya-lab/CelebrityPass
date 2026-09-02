import Link from "next/link";
import Image from "next/image";
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
  const catStyle = CATEGORY_STYLES[celebrity.category] ?? CATEGORY_STYLES["Public Figure"];
  return (
    <Link
      key={celebrity.id}
      href={`/celebrity/${celebrity.slug}`}
      className="card-hover glass group block overflow-hidden rounded-2xl"
    >
      <div className="relative h-14 overflow-hidden">
        {celebrity.coverImage ? (
          <Image
            src={celebrity.coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
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

      <div className="flex items-start justify-between px-5 pt-3">
        <div className="relative -mt-10">
          <div className="h-16 w-16 overflow-hidden rounded-2xl ring-4 ring-ink-900 shadow-lg">
            {celebrity.profileImage ? (
              <Image
                src={celebrity.profileImage}
                alt={celebrity.name}
                width={80}
                height={100}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div
                className="grid h-full w-full place-items-center text-lg font-bold text-white"
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
        <span className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${catStyle}`}>
          {celebrity.category}
        </span>
      </div>

      <div className="px-5 pb-5 pt-3">
        <h3 className="flex items-center gap-1.5 text-lg font-bold leading-tight text-white group-hover:gradient-text">
          {celebrity.name}
          <VerifiedBadge className="h-4 w-4" />
        </h3>
        <p className="mt-0.5 text-sm text-zinc-400">
          {celebrity.profession} · {celebrity.country}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">
          {celebrity.shortBio ?? celebrity.bio}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <div>
            <p className="text-base font-bold text-white">
              <CountUp value={celebrity.fanCount} />{" "}
              <span className="text-xs font-medium text-zinc-500">
                {celebrity.fanCount === 1 ? "Fan" : "Fans"}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              {celebrity.countryCount} {celebrity.countryCount === 1 ? "country" : "countries"} · live
            </p>
          </div>
          <span className="btn-grad rounded-full px-4 py-2 text-xs font-semibold text-white">
            Enter Community
          </span>
        </div>
      </div>
    </Link>
  );
}