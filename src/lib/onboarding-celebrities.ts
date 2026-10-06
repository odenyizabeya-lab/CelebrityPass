import { prisma } from "./db";

/**
 * The celebrity list shown on the onboarding screen.
 *
 * The list itself is public catalogue data — it depends only on the
 * `isActive`/`fansCardEnabled` flags, not on who is asking. The only
 * personalised part is `selected`, derived from the fan's existing rows. That
 * makes this a perfect candidate for a server-side read: the page already needs
 * the session, so loading here removes an entire client round-trip (and the
 * client-side "fetch on mount" pattern that left the screen spinning forever
 * when the request hung).
 *
 * Both queries are issued together, so the screen costs one round-trip rather
 * than the previous two (a count, then a separate client fetch).
 */
export interface OnboardingCelebrity {
  id: string;
  slug: string;
  name: string;
  profession: string;
  profileImage: string | null;
  accentColor: string;
  isVerified: boolean;
  selected: boolean;
}

export async function loadOnboardingCelebrities(
  fanId: string,
): Promise<OnboardingCelebrity[]> {
  const [celebrities, selections] = await Promise.all([
    prisma.celebrity.findMany({
      where: { isActive: true, fansCardEnabled: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        profession: true,
        profileImage: true,
        accentColor: true,
        isVerified: true,
      },
    }),
    prisma.fanCelebritySelection.findMany({
      where: { fanId },
      select: { celebrityId: true },
    }),
  ]);

  const selected = new Set(selections.map((s) => s.celebrityId));
  return celebrities.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    profession: c.profession,
    profileImage: c.profileImage,
    accentColor: c.accentColor,
    isVerified: c.isVerified,
    selected: selected.has(c.id),
  }));
}
