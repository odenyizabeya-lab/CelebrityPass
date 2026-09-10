/**
 * Shared announcement helpers for the admin Email Center API: resolve the
 * subject + per-fan renderer for each template category.
 */
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { renderEmailTemplate } from "./templates";
import { unsubscribeUrlFor } from "./senders";
import type { AudienceSpec } from "./audience";

export type AnnouncementInput = {
  audience: AudienceSpec;
  template: "NEW_CELEBRITY" | "UPDATE" | "COMMUNITY" | "PROMOTION";
  title?: string;
  subject?: string;
  message?: string;
};

/** Load the celebrity name/slug/category for NEW_CELEBRITY templates. */
export async function resolveCelebrity(celebrityId?: string) {
  if (!celebrityId) return null;
  return prisma.celebrity.findUnique({
    where: { id: celebrityId },
    select: { id: true, slug: true, name: true, category: true },
  });
}

/** Compute the default subject for an announcement template. */
export async function defaultSubject(input: AnnouncementInput): Promise<string> {
  const t = input.template;
  if (input.subject?.trim()) return input.subject.trim();
  if (t === "NEW_CELEBRITY") {
    const celeb = await resolveCelebrity(input.audience.celebrityId);
    return celeb ? `${celeb.name} is now on CelebrityPass` : "New celebrity on CelebrityPass";
  }
  if (t === "UPDATE") return "Important CelebrityPass update";
  if (t === "COMMUNITY") return "Update from CelebrityPass";
  return "From CelebrityPass";
}

/**
 * Personalised per-fan renderer. `htmlBody` (plain message for update/promo,
 * or the celebrity announcement) is rendered per recipient so names and the
 * unsubscribe URL are always correct.
 */
export function makeRenderer(input: AnnouncementInput, celeb: { slug: string; name: string; category: string } | null) {
  return (fan: { id: string; name: string; email: string }) => {
    switch (input.template) {
      case "NEW_CELEBRITY": {
        const name = celeb?.name ?? "A new celebrity";
        const category = celeb?.category ?? "Public Figure";
        const profileUrl = celeb ? `${appUrl()}/celebrity/${celeb.slug}` : appUrl();
        const { html } = renderEmailTemplate({ kind: "newCelebrity", fanName: fan.name, celebrityName: name, category, profileUrl });
        return { html };
      }
      case "PROMOTION": {
        const { html } = renderEmailTemplate({
          kind: "promotion",
          fanName: fan.name,
          message: input.message ?? "",
          unsubscribeUrl: unsubscribeUrlFor(fan.id),
        });
        return { html };
      }
      case "COMMUNITY":
      case "UPDATE":
      default: {
        const { html } = renderEmailTemplate({ kind: "update", fanName: fan.name, message: input.message ?? "" });
        return { html };
      }
    }
  };
}

/** Render a sample email for the composer preview (fan name "there"). */
export function renderSample(input: AnnouncementInput, celeb: { slug: string; name: string; category: string } | null) {
  const render = makeRenderer(input, celeb);
  return render({ id: "sample", name: "there", email: "you@example.com" }).html;
}

/** Stable dedupe prefix per template (seeds per-fan dedupeKeys). */
export function dedupePrefixFor(template: string): string {
  return template.toLowerCase().replace("_", "-");
}