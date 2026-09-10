import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getEmailFrom, getResendDomainsStatus } from "@/lib/emails/provider";
import { representedCountryList } from "@/lib/countries";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "SENDING", "SENT", "DELIVERED", "OPENED", "FAILED", "PERMANENT_FAILED"] as const;

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [fanCounts, emailByStatus, recent, announcements, providerFrom, domainsCfg] = await Promise.all([
    prisma.fan.count(),
    (async () => {
      const [counts, sent24h] = await Promise.all([
        Promise.all(STATUSES.map((s) => prisma.emailMessage.count({ where: { status: s } }))),
        prisma.emailMessage.count({ where: { status: { in: ["SENT", "DELIVERED", "OPENED"] }, sentAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
      ]);
      const map = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]]));
      return { ...map, sentLast24h: sent24h, total: counts.reduce((a, b) => a + b, 0) };
    })(),
    prisma.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.emailAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getEmailFrom(),
    getResendDomainsStatus(),
  ]);

  const [unsubscribed, verified, countryRows] = await Promise.all([
    prisma.fan.count({ where: { unsubscribedAt: { not: null } } }),
    prisma.fan.count({ where: { emailVerified: true } }),
    prisma.fan.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
  ]);

  const countries = representedCountryList(countryRows.map((f) => f.country));

  return NextResponse.json({
    totalFans: fanCounts,
    unsubscribedFans: unsubscribed,
    verifiedFans: verified,
    emailCounts: emailByStatus,
    recent: recent.map((m) => ({
      id: m.id,
      to: m.to,
      type: m.type,
      status: m.status,
      attempts: m.attempts,
      subject: m.subject,
      lastError: m.lastError,
      createdAt: m.createdAt,
      sentAt: m.sentAt,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      audienceType: a.audienceType,
      template: a.template,
      status: a.status,
      subject: a.subject,
      targetsCount: a.targetsCount,
      enqueuedCount: a.enqueuedCount,
      sentCount: a.sentCount,
      failedCount: a.failedCount,
      createdAt: a.createdAt,
    })),
    provider: {
      configuredFrom: providerFrom,
      configured: domainsCfg?.configured ?? false,
      domains: domainsCfg?.domains ?? [],
    },
    countries,
  });
}