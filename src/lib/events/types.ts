// Public event system — domain types & constants.
// IMPORTANT: This system stores ONLY publicly announced event information.

export const EVENT_TYPES = [
  "Concert",
  "Tour",
  "Festival",
  "Public appearance",
  "Award ceremony",
  "Movie premiere",
  "TV appearance",
  "Public interview",
  "Sports appearance",
  "Charity/public event",
  "Other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Live statuses. Status is DERIVED from dates + admin override, never stored
// as a lie: override (POSTPONED/CANCELLED) takes priority, otherwise computed
// from startAt/endAt vs now.
export const EVENT_STATUSES = ["UPCOMING", "HAPPENING_NOW", "COMPLETED", "POSTPONED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// Admin override statuses (the only ones an admin may force).
export const EVENT_OVERRIDES = ["POSTPONED", "CANCELLED"] as const;

export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "UPDATED", "CANCELLED", "POSTPONED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isEventType(v: string): v is EventType {
  return (EVENT_TYPES as readonly string[]).includes(v);
}

export function isEventStatus(v: string): v is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(v);
}

export function isVerification(v: string): v is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(v);
}

export function statusLabel(s: string): string {
  switch (s) {
    case "UPCOMING":
      return "Upcoming";
    case "HAPPENING_NOW":
      return "Happening Now";
    case "COMPLETED":
      return "Completed";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}
