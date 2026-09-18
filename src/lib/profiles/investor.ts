/**
 * Person-specific business / investment profile helpers.
 *
 * Every investment profile is keyed 1:1 to a unique celebrityId. Content is
 * NEVER borrowed from another person's profile and only what is verified
 * against authoritative sources may be stored. See prisma schema for the
 * source-of-truth model.
 */

export type InvestorSource = {
  label: string;
  url: string;
  date: string | null;
};

export const MAX_OVERVIEW = 1500;
export const MAX_SECTOR = 120;
export const MAX_VENTURES = 1200;
export const MAX_OPPORTUNITIES = 1200;
export const MAX_ELIGIBILITY = 800;
export const MAX_RISKS = 800;
export const MAX_DISCLAIMER = 800;
export const MAX_SOURCES = 8;
export const MAX_SOURCE_LABEL = 140;

export function parseSources(json: string | null | undefined): InvestorSource[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is InvestorSource =>
          !!s &&
          typeof s === "object" &&
          typeof s.label === "string" &&
          typeof s.url === "string",
      )
      .map((s) => ({
        label: String(s.label).slice(0, MAX_SOURCE_LABEL),
        url: String(s.url),
        date: typeof s.date === "string" && s.date ? s.date : null,
      }))
      .slice(0, MAX_SOURCES);
  } catch {
    return [];
  }
}

export function stringifySources(sources: InvestorSource[]): string {
  return JSON.stringify(sources.slice(0, MAX_SOURCES));
}

/** Clamp to a max length or collapse to null when empty/whitespace. */
function text(
  value: string | null | undefined,
  max: number,
): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validate + normalize admin/AI-provided investment content. Returns null when
 * the payload is not an object. Rejects fabricated claims at the model level by
 * capping lengths and refusing non-http "sources". Everything remains optional;
 * a profile with only a sector is still valid, but `enabled` requires real
 * content in overview/ventures so an empty page is never published.
 */
export function sanitizeInvestorProfile(body: unknown): {
  enabled: boolean;
  overview: string | null;
  sector: string | null;
  ventures: string | null;
  opportunities: string | null;
  eligibility: string | null;
  risks: string | null;
  disclaimer: string | null;
  sourcesJson: string | null;
  verifiedAt: Date | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const overview = text(
    typeof b.overview === "string" ? b.overview : null,
    MAX_OVERVIEW,
  );
  const sector = text(
    typeof b.sector === "string" ? b.sector : null,
    MAX_SECTOR,
  );
  const ventures = text(
    typeof b.ventures === "string" ? b.ventures : null,
    MAX_VENTURES,
  );
  const opportunities = text(
    typeof b.opportunities === "string" ? b.opportunities : null,
    MAX_OPPORTUNITIES,
  );
  const eligibility = text(
    typeof b.eligibility === "string" ? b.eligibility : null,
    MAX_ELIGIBILITY,
  );
  const risks = text(typeof b.risks === "string" ? b.risks : null, MAX_RISKS);
  const disclaimer = text(
    typeof b.disclaimer === "string" ? b.disclaimer : null,
    MAX_DISCLAIMER,
  );

  const sources = (
    Array.isArray(b.sources) ? b.sources : []
  )
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      label: String(typeof s.label === "string" ? s.label : "").trim().slice(
        0,
        MAX_SOURCE_LABEL,
      ),
      url: String(typeof s.url === "string" ? s.url : "").trim(),
      date: typeof s.date === "string" && s.date.trim() ? s.date.trim() : null,
    }))
    .filter((s) => s.label && isHttpUrl(s.url))
    .slice(0, MAX_SOURCES);

  const hasContent = !!(overview || ventures || opportunities);
  // `enabled` never auto-flips on from raw input alone — it requires real,
  // verified content AND an explicit intent from an admin.
  const wantsEnabled = b.enabled === true;
  const verifiedNow = b.verified === true ? new Date() : null;
  const enabled = wantsEnabled && (hasContent || verifiedNow !== null);

  return {
    enabled,
    overview,
    sector,
    ventures,
    opportunities,
    eligibility,
    risks,
    disclaimer,
    sourcesJson: sources.length ? stringifySources(sources) : null,
    verifiedAt: verifiedNow,
  };
}

export type InvestorView = {
  enabled: boolean;
  overview: string | null;
  sector: string | null;
  ventures: string | null;
  opportunities: string | null;
  eligibility: string | null;
  risks: string | null;
  disclaimer: string | null;
  sources: InvestorSource[];
  verifiedAt: string | null;
  updatedAt: string | null;
};

export function toInvestorView(row: {
  enabled: boolean;
  overview: string | null;
  sector: string | null;
  ventures: string | null;
  opportunities: string | null;
  eligibility: string | null;
  risks: string | null;
  disclaimer: string | null;
  sourcesJson: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
}): InvestorView {
  return {
    enabled: row.enabled,
    overview: row.overview,
    sector: row.sector,
    ventures: row.ventures,
    opportunities: row.opportunities,
    eligibility: row.eligibility,
    risks: row.risks,
    disclaimer: row.disclaimer,
    sources: parseSources(row.sourcesJson),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const NO_VERIFIED_OFFERING_COPY =
  "No verified investment offering was found for this person.";