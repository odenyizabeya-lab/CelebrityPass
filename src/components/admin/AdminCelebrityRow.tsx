"use client";

import { useRouter } from "next/navigation";

/**
 * A whole-row tappable celebrity entry — tapping anywhere on the row opens the
 * celebrity's admin page in one click (app-style), instead of hunting for a
 * small "Edit" button.
 */
export default function AdminCelebrityRow({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <li
      onClick={() => router.push(`/admin/celebrities/${id}`)}
      className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03] active:bg-white/[0.05]"
    >
      {children}
    </li>
  );
}