/**
 * Content generators — turn real marketplace entities into publishable posts.
 *
 * Each content type has an explicit generator that:
 *   - only emits entities flagged `socialAutoPost` (admin eligibility control)
 *   - builds a stable `contentKey` so the unique(platform, contentKey)
 *     constraint prevents duplicates forever
 *   - builds a default caption from real data
 */

import { prisma } from "@/lib/db";
import type { ContentType, SocialMediaRef } from "./types";
import { appUrl, formatDate } from "@/lib/utils";

export interface GeneratedPost {
  contentKey: string;
  contentType: ContentType;
  contentRefId: string;
  title: string;
  caption: string;
  linkUrl?: string;
  media: SocialMediaRef[];
}

/** Return new eligible entities of a content type created since `since`. */
export async function generateNewContent(
  contentType: ContentType,
  since: Date | null,
): Promise<GeneratedPost[]> {
  switch (contentType) {
    case "celebrity":
      return celebrityPosts(since);
    case "membership":
      return membershipPosts(since);
    case "event":
      return eventPosts(since);
    case "article":
      return articlePosts(since);
    case "promo":
      return []; // promos are created manually in the queue with exact timing
    default:
      return [];
  }
}

async function celebrityPosts(since: Date | null): Promise<GeneratedPost[]> {
  const rows = await prisma.celebrity.findMany({
    where: {
      socialAutoPost: true,
      isActive: true,
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((c) => ({
    contentKey: `celebrity:${c.id}`,
    contentType: "celebrity",
    contentRefId: c.id,
    title: c.name,
    caption: `Welcome ${c.name} to KCO Global! 🎉\nJoin the official ${c.name} community and get your official fan card.`,
    linkUrl: `${appUrl()}/celebrity/${c.slug}`,
    media: c.profileImage ? [{ url: c.profileImage, mimeType: "image/jpeg" }] : [],
  }));
}

async function membershipPosts(since: Date | null): Promise<GeneratedPost[]> {
  const rows = await prisma.membershipLevel.findMany({
    where: { socialAutoPost: true, isActive: true, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { celebrity: { select: { name: true, slug: true, profileImage: true } } },
    take: 50,
  });
  return rows.map((m) => {
    const price = m.price != null ? `${m.currency} ${m.price}` : "Free";
    return {
      contentKey: `membership:${m.id}`,
      contentType: "membership",
      contentRefId: m.id,
      title: `${m.celebrity.name} — ${m.name}`,
      caption: `${m.name} membership for ${m.celebrity.name} is now available!\n${m.description ?? m.benefits ?? ""}\nOnly ${price}.`,
      linkUrl: `${appUrl()}/celebrity/${m.celebrity.slug}`,
      media: m.celebrity.profileImage ? [{ url: m.celebrity.profileImage, mimeType: "image/jpeg" }] : [],
    };
  });
}

async function eventPosts(since: Date | null): Promise<GeneratedPost[]> {
  const rows = await prisma.celebrityEvent.findMany({
    where: { socialAutoPost: true, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { celebrity: { select: { name: true, slug: true, profileImage: true } } },
    take: 50,
  });
  return rows.map((e) => {
    const when = e.startAt ? formatDate(e.startAt) : "";
    const where = [e.venue, e.city, e.country].filter(Boolean).join(", ");
    return {
      contentKey: `event:${e.id}`,
      contentType: "event",
      contentRefId: e.id,
      title: e.name,
      caption: `${e.name} — ${when}${where ? ` at ${where}` : ""}\n${e.description ?? ""}\nRegister now!`,
      linkUrl: e.officialUrl ?? e.ticketUrl ?? `${appUrl()}/celebrity/${e.celebrity.slug}`,
      media: e.celebrity.profileImage ? [{ url: e.celebrity.profileImage, mimeType: "image/jpeg" }] : [],
    };
  });
}

async function articlePosts(since: Date | null): Promise<GeneratedPost[]> {
  const rows = await prisma.socialArticle.findMany({
    where: {
      status: "PUBLISHED",
      autoPostEnabled: true,
      ...(since ? { publishedAt: { gt: since } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    include: { linkedCelebrity: { select: { slug: true } } },
    take: 50,
  });
  return rows.map((a) => ({
    contentKey: `article:${a.id}`,
    contentType: "article",
    contentRefId: a.id,
    title: a.title,
    caption: `${a.title}\n\n${a.summary ?? ""}`.trim(),
    linkUrl: `${appUrl()}/admin/marketing/articles`,
    media: a.coverImage ? [{ url: a.coverImage, mimeType: "image/jpeg" }] : [],
  }));
}