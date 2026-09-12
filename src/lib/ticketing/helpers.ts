// Ticketing pure helpers: money, references, order history.
import crypto from "crypto";

/** Format a cents amount as currency, e.g. 4999 USD -> "$49.99". */
export function formatTicketPrice(cents: number | null | undefined, currency = "USD"): string {
  // Defensive: a non-finite or missing amount renders as "$0.00" — never "NaN".
  const safeCents = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  const amount = safeCents / 100;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Unique consumer-facing order reference, e.g. TCK-mabc123-xyz. */
export function newOrderRef(): string {
  return `TCK-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

/** Secret order access token — grants the holder access to order details. */
export function newAccessToken(): string {
  return crypto.randomBytes(18).toString("hex");
}

type HistoryEntry = { status: string; at: string; note?: string };

export function parseStatusHistory(raw: string | null | undefined): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Drop any malformed entries defensively so a bad row can never crash a page.
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as HistoryEntry).status === "string" &&
        typeof (e as HistoryEntry).at === "string",
    );
  } catch {
    return [];
  }
}

export function pushStatusHistory(raw: string | null | undefined, entry: HistoryEntry): string {
  const next = [...parseStatusHistory(raw), entry];
  return JSON.stringify(next.slice(-50));
}

/** Estimated next-sync label for a source (derived from last sync + interval). */
export function nextSyncLabel(lastSyncAt: Date | string | null | undefined, intervalMinutes: number): string | null {
  if (!lastSyncAt) return null;
  const last = new Date(lastSyncAt);
  if (Number.isNaN(last.getTime()) || typeof intervalMinutes !== "number" || !Number.isFinite(intervalMinutes)) return null;
  const next = new Date(last.getTime() + intervalMinutes * 60_000);
  const deltaMs = next.getTime() - Date.now();
  if (deltaMs <= 0) return "Due now";
  const mins = Math.round(deltaMs / 60_000);
  return mins < 60 ? `in ~${mins} min` : `in ~${Math.round(mins / 60)} hr`;
}

/** Safety clamp for ticket quantity against disclosed availability. */
export function clampQuantity(qty: number, available: number | null | undefined, max = 8): number {
  let q = Math.min(Math.max(Math.floor(qty), 1), max);
  if (available != null && available >= 0) q = Math.min(q, available);
  return q;
}

/** Unique ticket code for QR display, e.g. TKT-a1b2c3d4e5f6. */
export function newTicketCode(): string {
  return `TKT-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}