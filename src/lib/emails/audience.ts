/**
 * Audience targeting for announcements.
 *
 * Resolves a fan-scoped eligibility query for each audience type, then fans
 * recipients out into individual EmailMessage rows in batches. Recipient
 * selection always respects notification preferences + unsubscription, so a
 * fan who unsubscribed can never be re-sent to.
 */
import { prisma } from "@/lib/db";
import { enqueueEmail } from "./queue";

export type AudienceSpec = {
  type: "ALL_SUBSCRIBED" | "NEW_CELEBRITY" | "CELEBRITY_FANS" | "MEMBERSHIP_LEVEL" | "COUNTRY" | "SPECIFIC_FANS";
  celebrityId?: string;
  membershipLevelId?: string;
  country?: string;
  fanEmails?: string[];
};

/** The fan preference that gates each announcement category. */
export const PREF_BY_TEMPLATE = {
  NEW_CELEBRITY: "notifyNewCelebrities",
  UPDATE: "notifyUpdates",
  COMMUNITY: "notifyCommunity",
  PROMOTION: "notifyPromotions",
} as const satisfies Record<string, keyof FanPrefs>;

type FanPrefs = {
  notifyNewCelebrities: boolean;
  notifyUpdates: boolean;
  notifyCommunity: boolean;
  notifyPromotions: boolean;
};

/**
 * Build the prisma Fan where-filter for an audience. `template` decides which
 * preference flag must be on.
 */
export function fanAudienceWhere(spec: AudienceSpec, template: string): Record<string, unknown> {
  const prefKey = (PREF_BY_TEMPLATE as Record<string, keyof FanPrefs>)[template] ?? PREF_BY_TEMPLATE.NEW_CELEBRITY;

  const where: Record<string, unknown> = {
    isActive: true,
    unsubscribedAt: null,
    [prefKey]: true,
  };

  switch (spec.type) {
    case "ALL_SUBSCRIBED":
    case "NEW_CELEBRITY":
      break;
    case "CELEBRITY_FANS":
      where.cards = { some: { celebrityId: spec.celebrityId } };
      break;
    case "MEMBERSHIP_LEVEL":
      where.cards = { some: { membershipLevelId: spec.membershipLevelId } };
      break;
    case "COUNTRY":
      where.country = spec.country ?? undefined;
      break;
    case "SPECIFIC_FANS":
      where.email = { in: spec.fanEmails ?? [] };
      break;
  }
  return where;
}

/** Count the fans who would receive this announcement. */
export async function countAudience(spec: AudienceSpec, template: string): Promise<number> {
  return prisma.fan.count({ where: fanAudienceWhere(spec, template) as never });
}

/**
 * Fan out an announcement into individual EmailMessage rows.
 * `render` produces a personalized html per fan; `dedupePrefix` seeds the
 * per-fan dedupeKey so re-running is a no-op (never duplicate sends).
 */
export async function fanOutAnnouncement(opts: {
  announcementId: string;
  audience: AudienceSpec;
  template: string;
  type: string;
  subject: string;
  render: (fan: { id: string; email: string; name: string }) => { html: string };
  dedupePrefix: string;
}): Promise<{ targets: number; enqueued: number }> {
  const where = fanAudienceWhere(opts.audience, opts.template);
  const targets = await prisma.fan.count({ where: where as never });

  const BATCH = 400;
  let cursor: string | null = null;
  let enqueued = 0;

  // Fly over the audience in keyset batches (never page deep in one request).
  for (;;) {
    const fans: Array<{ id: string; email: string; name: string }> = await prisma.fan.findMany({
      where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) } as never,
      select: { id: true, email: true, name: true },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (fans.length === 0) break;

    // Insert each fan's message; skipDuplicates makes parallel/repeat runs safe.
    const inserted = await prisma.emailMessage.createMany({
      data: fans.map((fan) => {
        const { html } = opts.render(fan);
        return {
          fanId: fan.id,
          announcementId: opts.announcementId,
          dedupeKey: `${opts.dedupePrefix}:${opts.announcementId}:${fan.id}`,
          type: opts.type,
          to: fan.email,
          subject: opts.subject,
          template: opts.template,
          htmlBody: html,
        };
      }),
      skipDuplicates: true,
    });
    enqueued += inserted.count;

    cursor = fans[fans.length - 1]!.id;
    if (fans.length < BATCH) break;
  }

  return { targets, enqueued };
}

export { enqueueEmail };