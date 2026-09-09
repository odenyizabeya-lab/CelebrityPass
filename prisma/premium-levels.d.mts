export type PremiumLevelTemplate = {
  name: string;
  price: number;
  tagline: string;
  benefits: string[];
};

export const PREMIUM_LEVELS: PremiumLevelTemplate[];
export const PREMIUM_DISPLAY_ORDER_BASE: number;
export function upsertPremiumLevels(
  prisma: unknown,
  celebrity: { id: string; name: string; slug: string },
): Promise<{ created: number; updated: number }>;