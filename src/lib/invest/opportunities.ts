import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateInvestAmount } from "./mode";

/**
 * Investment opportunity reads + server-side rule engine. The amount RAISED is
 * derived from confirmed ledger-backed positions — it can never be typed in.
 * Eligibility is opportunity-specific and checked on the server before any
 * subscription.
 */

export type OpportunityEligibility = {
  minAgeYears?: number;
  countries?: string[];
  investorTypes?: string[];
  kycRequired?: boolean;
  text?: string;
};

export function parseEligibility(json: string | null): OpportunityEligibility | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as OpportunityEligibility;
  } catch {
    return null;
  }
}

export type OpportunityPeriod = {
  opensAt?: string;
  closesAt?: string;
  lockupDays?: number;
  maturityLabel?: string;
};

export function parseInvestmentPeriod(json: string | null): OpportunityPeriod | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as OpportunityPeriod;
    if (!v || typeof v !== "object") return null;
    return {
      opensAt: typeof v.opensAt === "string" ? v.opensAt : undefined,
      closesAt: typeof v.closesAt === "string" ? v.closesAt : undefined,
      lockupDays: typeof v.lockupDays === "number" ? v.lockupDays : undefined,
      maturityLabel: typeof v.maturityLabel === "string" ? v.maturityLabel : undefined,
    };
  } catch {
    return null;
  }
}

export type OpportunityFees = { subscriptionRate?: number };

export function parseFees(json: string | null): OpportunityFees | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as OpportunityFees;
    if (!v || typeof v !== "object") return null;
    return {
      subscriptionRate: typeof v.subscriptionRate === "number" ? v.subscriptionRate : undefined,
    };
  } catch {
    return null;
  }
}

export type OpportunityDisclosure = { key: string; version: string; title?: string };

export function parseDisclosures(json: string | null): OpportunityDisclosure[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as OpportunityDisclosure[]) : [];
  } catch {
    return [];
  }
}

export type OpportunityView = {
  id: string;
  slug: string;
  name: string;
  companyName: string | null;
  investmentType: string;
  description: string | null;
  status: string;
  minAmount: Prisma.Decimal | null;
  maxAmount: Prisma.Decimal | null;
  targetAmount: Prisma.Decimal | null;
  raisedAmount: Prisma.Decimal;
  currency: string;
  feesJson: string | null;
  investmentPeriodJson: string | null;
  liquidityText: string | null;
  risksText: string | null;
  expectedReturnText: string | null;
  eligibilityJson: string | null;
  disclosuresJson: string | null;
  legalTermsText: string | null;
  linkedCelebritySlug: string | null;
  linkedCelebrityName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OpportunityRow = {
  id: string;
  slug: string;
  name: string;
  companyName: string | null;
  investmentType: string;
  description: string | null;
  status: string;
  minAmount: Prisma.Decimal | null;
  maxAmount: Prisma.Decimal | null;
  targetAmount: Prisma.Decimal | null;
  currency: string;
  feesJson: string | null;
  investmentPeriodJson: string | null;
  liquidityText: string | null;
  risksText: string | null;
  expectedReturnText: string | null;
  eligibilityJson: string | null;
  disclosuresJson: string | null;
  legalTermsText: string | null;
  createdAt: Date;
  updatedAt: Date;
  linkedCelebrity: { slug: string; name: string } | null;
};

/** Total confirmed amount (from positions) for a set of opportunities. */
async function raisedTotals(opportunityIds: string[]): Promise<Map<string, Prisma.Decimal>> {
  const map = new Map<string, Prisma.Decimal>();
  if (opportunityIds.length === 0) return map;
  for (const id of opportunityIds) map.set(id, new Prisma.Decimal(0));
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      account: { startsWith: "investor:" },
      AND: { account: { contains: ":position:" } },
    },
    select: { account: true, amount: true },
  });
  for (const row of rows) {
    // account format: investor:<inv>:position:<oppId>
    const match = /^investor:[^:]+:position:(.+)$/.exec(row.account);
    if (match && map.has(match[1])) {
      map.set(match[1], new Prisma.Decimal(map.get(match[1])!).plus(row.amount));
    }
  }
  return map;
}

export function toOpportunityView(row: OpportunityRow, raised: Prisma.Decimal): OpportunityView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    companyName: row.companyName,
    investmentType: row.investmentType,
    description: row.description,
    status: row.status,
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    targetAmount: row.targetAmount,
    raisedAmount: raised,
    currency: row.currency,
    feesJson: row.feesJson,
    investmentPeriodJson: row.investmentPeriodJson,
    liquidityText: row.liquidityText,
    risksText: row.risksText,
    expectedReturnText: row.expectedReturnText,
    eligibilityJson: row.eligibilityJson,
    disclosuresJson: row.disclosuresJson,
    legalTermsText: row.legalTermsText,
    linkedCelebritySlug: row.linkedCelebrity?.slug ?? null,
    linkedCelebrityName: row.linkedCelebrity?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOpportunities(opts: {
  onlyOpen?: boolean;
  investmentType?: string;
  q?: string;
} = {}): Promise<OpportunityView[]> {
  const rows = await prisma.investmentOpportunity.findMany({
    where: {
      ...(opts.onlyOpen ? { status: { in: ["OPEN", "PENDING"] } } : {}),
      ...(opts.investmentType ? { investmentType: opts.investmentType } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: "insensitive" } },
              { companyName: { contains: opts.q, mode: "insensitive" } },
              { description: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { linkedCelebrity: { select: { slug: true, name: true } } },
  }) as unknown as OpportunityRow[];

  const totals = await raisedTotals(rows.map((r) => r.id));
  return rows.map((row) => toOpportunityView(row, totals.get(row.id) ?? new Prisma.Decimal(0)));
}

export async function getOpportunityBySlug(slug: string): Promise<OpportunityView | null> {
  const row = (await prisma.investmentOpportunity.findUnique({
    where: { slug },
    include: { linkedCelebrity: { select: { slug: true, name: true } } },
  })) as unknown as OpportunityRow | null;
  if (!row) return null;
  const totals = await raisedTotals([row.id]);
  return toOpportunityView(row, totals.get(row.id) ?? new Prisma.Decimal(0));
}

export async function getOpportunityById(id: string): Promise<OpportunityView | null> {
  const row = (await prisma.investmentOpportunity.findUnique({
    where: { id },
    include: { linkedCelebrity: { select: { slug: true, name: true } } },
  })) as unknown as OpportunityRow | null;
  if (!row) return null;
  const totals = await raisedTotals([row.id]);
  return toOpportunityView(row, totals.get(row.id) ?? new Prisma.Decimal(0));
}

/**
 * Open opportunities linked to one celebrity (business/political people only —
 * never surfaced for the fan-system/entertainment profiles).
 */
export async function listOpportunitiesForCelebrity(celebrityId: string): Promise<OpportunityView[]> {
  const rows = (await prisma.investmentOpportunity.findMany({
    where: { linkedCelebrityId: celebrityId, status: { in: ["OPEN", "PENDING"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { linkedCelebrity: { select: { slug: true, name: true } } },
  })) as unknown as OpportunityRow[];
  if (rows.length === 0) return [];
  const totals = await raisedTotals(rows.map((r) => r.id));
  return rows.map((row) => toOpportunityView(row, totals.get(row.id) ?? new Prisma.Decimal(0)));
}

/** Server-side amount gate against the platform range AND this opportunity's own limits. */
export function validateOppAmount(opp: { minAmount: Prisma.Decimal | null; maxAmount: Prisma.Decimal | null }, amount: Prisma.Decimal): string | null {
  return validateInvestAmount(amount, opp.minAmount, opp.maxAmount);
}

/** Whether the opportunity is open to new subscriptions right now. */
export function isAcceptingFunds(opp: { status: string; targetAmount: Prisma.Decimal | null; raisedAmount: Prisma.Decimal }): boolean {
  if (!["OPEN", "PENDING"].includes(opp.status)) return false;
  if (opp.targetAmount && opp.raisedAmount.gte(opp.targetAmount)) return false;
  return true;
}

/**
 * Eligibility gate. Returns the first blocking reason or null when the investor
 * may proceed. Never auto-grants eligibility from registration or category.
 */
export async function checkEligibility(input: {
  opp: { eligibilityJson: string | null; kycRequired?: boolean };
  investor: { country: string | null; kycStatus: string };
  ageYears?: number | null;
}): Promise<string | null> {
  const rule = parseEligibility(input.opp.eligibilityJson);
  if (!rule) return null;
  if (rule.minAgeYears && input.ageYears !== null && input.ageYears !== undefined) {
    if (input.ageYears < rule.minAgeYears) {
      return `You must be at least ${rule.minAgeYears} years old for this investment.`;
    }
  }
  if (Array.isArray(rule.countries) && rule.countries.length > 0) {
    if (!input.investor.country || !rule.countries.some((c) => c.toUpperCase() === input.investor.country?.toUpperCase())) {
      return "This investment is not available in your country of residence.";
    }
  }
  const kycRequired = rule.kycRequired ?? input.opp.kycRequired ?? false;
  if (kycRequired && input.investor.kycStatus !== "VERIFIED") {
    return "Your identity (KYC) must be verified for this investment.";
  }
  if (Array.isArray(rule.investorTypes) && rule.investorTypes.length > 0) {
    return "This investment is restricted to a specific investor type.";
  }
  return null;
}

/** Which disclosures must be acknowledged before subscribing to this opportunity. */
export function requiredDisclosures(opp: { disclosuresJson: string | null }): OpportunityDisclosure[] {
  return parseDisclosures(opp.disclosuresJson);
}