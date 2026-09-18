import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Investor product configuration. LIVE_MODE must never flip on until real
 * payment/legal/regulatory/custody infrastructure exists. In DEMO mode every
 * screen shows a DEMO / TEST MODE marker and all money movements run through
 * the simulated provider pipeline — successful states come only from the
 * backend, never the frontend.
 */

export const INVEST_SETTING_MODE = "invest.mode"; // "demo" | "live"
export const INVEST_MIN_AMOUNT = new Prisma.Decimal(100); // platform-supported floor (USD)
export const INVEST_MAX_AMOUNT = new Prisma.Decimal(15_000_000); // platform-supported ceiling (USD)

export async function isInvestLive(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: INVEST_SETTING_MODE } });
  return row?.value === "live";
}

export async function isDemoMode(): Promise<boolean> {
  return !(await isInvestLive());
}

/** The product must be able to say exactly what mode it is in. */
export async function investModeLabel(): Promise<string> {
  return (await isInvestLive()) ? "LIVE" : "DEMO / TEST MODE";
}

/**
 * Every subscription/deposit amount must be within the platform range AND the
 * specific opportunity's own [min, max] — enforced server-side, never relied
 * on UI. Returns an error string or null when the amount is acceptable.
 */
export function validateInvestAmount(amount: Prisma.Decimal, min?: Prisma.Decimal | null, max?: Prisma.Decimal | null): string | null {
  const value = new Prisma.Decimal(amount);
  if (value.lt(INVEST_MIN_AMOUNT)) {
    return `Amount must be at least $${formatMoney(INVEST_MIN_AMOUNT)}.`;
  }
  if (value.gt(INVEST_MAX_AMOUNT)) {
    return `Amount exceeds the platform maximum of $${formatMoney(INVEST_MAX_AMOUNT)}.`;
  }
  if (min !== null && min !== undefined && value.lt(min)) {
    return `This investment requires a minimum of $${formatMoney(min)}.`;
  }
  if (max !== null && max !== undefined && value.gt(max)) {
    return `This investment accepts at most $${formatMoney(max)} per investor.`;
  }
  return null;
}

/** Parse a client-supplied amount string into an exact 2dp Decimal, or null. */
export function toDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  try {
    const d = new Prisma.Decimal(raw);
    if (d.isNegative() || d.isNaN() || !d.isFinite()) return null;
    return d;
  } catch {
    return null;
  }
}

export function toDecimalOrZero(value: unknown): Prisma.Decimal {
  return toDecimal(value) ?? new Prisma.Decimal(0);
}

/** "$1,234.56" — exact currency rendering for server-rendered pages. */
export function formatMoney(value: Prisma.Decimal | number | string, currency = "USD"): string {
  const d = typeof value === "string" || typeof value === "number" ? new Prisma.Decimal(value) : value;
  return `${currency === "USD" ? "$" : currency + " "}${d.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

export type DbClient = PrismaClient;