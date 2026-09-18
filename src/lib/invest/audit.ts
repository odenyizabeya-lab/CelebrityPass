import { prisma } from "@/lib/db";

/**
 * Append-only audit trail + compliance flags + investor notifications.
 * Nothing here fabricates success — every entry describes a real recorded event.
 */

export type AuditActor = { actorType: "admin" | "investor" | "system"; actorId?: string | null };

export async function auditLog(input: {
  actorType: "admin" | "investor" | "system";
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      detailsJson: input.details === undefined ? null : JSON.stringify(input.details),
      ipAddress: input.ipAddress ?? null,
    },
  });
}

/** AML/fraud-watch flag for a human compliance review. Never auto-accuses. */
export async function raiseComplianceAlert(input: {
  investorId?: string | null;
  level?: "LOW" | "MEDIUM" | "HIGH";
  ruleKey: string;
  message: string;
  details?: unknown;
}) {
  await prisma.complianceAlert.create({
    data: {
      investorId: input.investorId ?? null,
      level: input.level ?? "LOW",
      ruleKey: input.ruleKey,
      message: input.message,
      detailsJson: input.details === undefined ? null : JSON.stringify(input.details),
    },
  });
}

export async function notifyInvestor(input: {
  investorId: string;
  type: string;
  title: string;
  body?: string | null;
}) {
  await prisma.investNotification.create({
    data: {
      investorId: input.investorId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
    },
  });
}