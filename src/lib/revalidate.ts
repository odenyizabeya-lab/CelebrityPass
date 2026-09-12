import { revalidatePath } from "next/cache";

/**
 * Invalidates the publicly cached pages affected by a celebrity create / edit /
 * delete so the very next request shows the new state (no ISR staleness).
 *
 * Route handlers may call `revalidatePath` in this Next build. `/celebrities`,
 * the search APIs and `/discovery` are force-dynamic already, so the real
 * targets are the ISR profile pages (`revalidate = 60`) and the home page —
 * but revalidating the whole surface costs nothing and covers every page that
 * lists celebrities.
 */
export function revalidateCelebrityPages(slug?: string | null) {
  revalidatePath("/", "page");
  revalidatePath("/celebrities", "page");
  revalidatePath("/discovery", "page");
  if (slug) revalidatePath(`/celebrity/${slug}`, "page");
}