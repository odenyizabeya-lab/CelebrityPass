"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VerifiedBadge from "@/components/VerifiedBadge";
import AdminListDeleteButton from "@/components/admin/AdminListDeleteButton";

/**
 * A whole-row tappable celebrity entry — tapping anywhere on the row opens the
 * celebrity's admin page in one click (app-style), instead of hunting for a
 * small "Edit" button.
 *
 * Entirely client-rendered: every interactive child (Edit/View links with
 * stopPropagation, the delete button) lives here, so no event handlers ever
 * cross the server → client component boundary. The page only passes plain,
 * serializable data.
 */
export default function AdminCelebrityRow({
  id,
  slug,
  name,
  country,
  profession,
  accentColor,
  isVerified,
  isFeatured,
  isActive,
  fans,
  levels,
  hasProfile,
}: {
  id: string;
  slug: string;
  name: string;
  country: string;
  profession: string;
  accentColor: string;
  isVerified: boolean;
  isFeatured: boolean;
  isActive: boolean;
  fans: number;
  levels: number;
  hasProfile: boolean;
}) {
  const router = useRouter();
  return (
    <li
      onClick={() => router.push(`/admin/celebrities/${id}`)}
      className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03] active:bg-white/[0.05]"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-900 p-1">
        {hasProfile ? (
          <Image
            src={`/images/${slug}/profile`}
            alt=""
            width={48}
            height={60}
            className="h-full w-full rounded-md object-cover object-top"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center rounded-md text-sm font-bold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {name[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1 font-bold text-white">
            {name}
            {isVerified && <VerifiedBadge className="h-4 w-4" />}
          </p>
          {isFeatured && (
            <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold text-gold-400">
              ★ Featured
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">
          /celebrity/{slug} · {profession} · {country}
        </p>
      </div>
      <div className="flex items-center gap-5 text-xs text-zinc-400">
        <span title="Fans">{fans} fans</span>
        <span title="Membership levels">{levels} levels</span>
        <span
          className={`rounded-full px-2.5 py-1 font-bold ${
            isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-600/20 text-zinc-400"
          }`}
        >
          {isActive ? "Active" : "Hidden"}
        </span>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/admin/celebrities/${id}`}
          prefetch
          onClick={(e) => e.stopPropagation()}
          className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5"
        >
          Edit
        </Link>
        <Link
          href={`/celebrity/${slug}`}
          onClick={(e) => e.stopPropagation()}
          className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:text-white sm:inline-flex"
        >
          View →
        </Link>
        <AdminListDeleteButton id={id} name={name} />
      </div>
    </li>
  );
}