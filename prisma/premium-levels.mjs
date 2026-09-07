// Premium fan-card "Experience" tiers, from $2,500 up to the $15,000,000 cap.
// Every celebrity — existing or added later — inherits exactly this shared
// 15-rung ladder, so the ceiling is always $15,000,000, never above.
//
// Used by:
//   - prisma/apply-premium-levels.mjs  (one-off upsert into an existing DB)
//   - prisma/seed.mjs                  (so a fresh seed creates them too)
// The {name} placeholder is replaced with each celebrity's name when upserting.

export const PREMIUM_LEVELS = [
  {
    name: "Red Carpet",
    price: 2500,
    tagline: "A private one-on-one meeting with the star — up close and personal.",
    benefits: [
      "Private one-on-one meet & greet with {name}",
      "Personalized video greeting message from {name}",
      "Autographed collector's photo, signed by {name}",
      "Priority access to {name}'s public events and appearances",
      "2 VIP show tickets to any upcoming {name} concert of your choice",
      "Exclusive 'Red Carpet' fan-card tier with verified status",
    ],
  },
  {
    name: "Backstage",
    price: 3000,
    tagline: "{name} takes you behind the scenes of a real show day.",
    benefits: [
      "Everything in Red Carpet, plus:",
      "Backstage tour of {name}'s dressing room and production area at a real show",
      "Two extra guest passes for the meet & greet (you + 2 guests)",
      "Priority booking access to future {name} experiences",
      "Signed merchandise bundle delivered to your door",
      "Early access to new {name} releases and announcements",
    ],
  },
  {
    name: "Encore",
    price: 4000,
    tagline: "A show-within-the-show: private moments around {name}'s real performance.",
    benefits: [
      "Everything in Backstage, plus:",
      "{name} dedicates a song to you live during a real show",
      "Soundcheck viewing spot on stage with {name}'s crew",
      "Professional photo session with {name} before the show",
      "A second autographed collector's item of your choice (album, guitar or jersey)",
    ],
  },
  {
    name: "Spotlight",
    price: 5000,
    tagline: "Front-of-house luxury: a private dinner and the best seats at the show.",
    benefits: [
      "Everything in Encore, plus:",
      "Private pre-show dinner with {name} at a hand-picked restaurant",
      "4 premium front-row seats to any {name} concert in your region",
      "{name} welcomes your group from the stage by name",
      "Meet-and-greet photo pass for your entire party",
      "VIP entrance, parking and hospitality at the venue",
    ],
  },
  {
    name: "Golden Hour",
    price: 10000,
    tagline: "Elevated access: backstage, a professional session and a show dedicated to you.",
    benefits: [
      "Everything in Spotlight, plus:",
      "Full backstage access throughout the show day with {name}'s team",
      "After-party or second-night table with {name} and their inner circle",
      "Professional studio photo session with {name} (delivered, ready to post)",
      "Personalized video shoutout for a friend or family member",
      "Signed collector's merchandise vault delivered to your door",
    ],
  },
  {
    name: "Front Row",
    price: 20000,
    tagline: "A two-day private experience around {name}'s greatest performances.",
    benefits: [
      "Everything in Golden Hour, plus:",
      "Two-day experience — rehearsal, soundcheck and show with full backstage access",
      "Travel and five-star accommodation for you and 3 guests included",
      "{name} joins your dinner table for a private conversation night",
      "6 VIP weekend show tickets with hospitality lounge access",
      "A dedicated personal concierge from {name}'s team for the weekend",
    ],
  },
  {
    name: "Platinum Show",
    price: 50000,
    tagline: "{name} performs live for you and up to 50 guests at the venue of your choice.",
    benefits: [
      "Everything in Front Row, plus:",
      "{name} performs a private, intimate set for you and up to 50 guests",
      "Your choice of venue — home, garden, rooftop, studio or event space",
      "Meet-and-greet line for every one of your guests with {name}",
      "10 premium show tickets to any {name} concert of your choice, with an exclusive pre-show meet & greet",
      "Full sound and lighting production with professional photos of the night",
    ],
  },
  {
    name: "Headline",
    price: 100000,
    tagline: "A headline evening: {name} headlines your private event with press and red carpet.",
    benefits: [
      "Everything in Platinum Show, plus:",
      "{name} headlines your celebration (birthday, brand launch or gala) for up to 100 guests",
      "Red-carpet arrival with professional press photos of your event",
      "A 30-minute private performance and Q&A hosted by {name}",
      "{name} records promotional content for your cause or business",
      "Event insurance, security and crowd management fully arranged",
      "Travel and five-star hotel for you and 10 guests",
    ],
  },
  {
    name: "Diamond Gala",
    price: 250000,
    tagline: "The celebrity comes to your event and hosts it for up to 250 guests.",
    benefits: [
      "Everything in Headline, plus:",
      "{name} hosts your event — wedding, birthday, gala or company party",
      "A full private performance for up to 250 guests at the venue you choose",
      "Private VIP box for 20 guests at any {name} show of your choice, with an invite to the official after-party",
      "Concierge planning by {name}'s events team from start to finish",
      "First-class travel and five-star accommodation for you and 10 guests",
    ],
  },
  {
    name: "Diamond Crown",
    price: 500000,
    tagline: "A two-day crowned celebration with press, production and complete planning.",
    benefits: [
      "Everything in Diamond Gala, plus:",
      "Two-day crowned celebration — {name} presents your event across two nights",
      "40 guests hosted in a private VIP suite for a {name} show of your choice",
      "Official after-party hosted by {name} at a venue of your choosing",
      "Documentary-style film crew captures your entire experience",
      "{name} unveils your brand, cause or milestone in an international press feature",
      "Dedicated events director and on-site executive team for both days",
    ],
  },
  {
    name: "Sovereign Experience",
    price: 1000000,
    tagline: "A worldwide day and a full produced private concert with the star.",
    benefits: [
      "Everything in Diamond Crown, plus:",
      "A worldwide experience day with {name} — you choose the city",
      "Full private concert with professional production for up to 1,000 guests",
      "{name} joins your personal or company celebration as host and performer",
      "Private VIP box for 50 guests at any {name} show worldwide, plus full tour backstage passes",
      "After-party hosted by {name} for you and your VIP circle",
      "Personal styling session, luxury shopping day and sit-down interview time",
      "A dedicated liaison from {name}'s management for a full year",
    ],
  },
  {
    name: "The Immortal",
    price: 2000000,
    tagline: "The star flies to you, anywhere on earth, for a once-in-a-lifetime private experience.",
    benefits: [
      "Everything in Sovereign Experience, plus:",
      "{name} flies to you — anywhere on earth — for a once-in-a-lifetime private experience",
      "A full-length private performance or personal appearance at any venue you choose",
      "A private one-on-one day with {name} (no cameras, just the two of you)",
      "A completely custom event — your theme, your location, {name}'s stage",
      "Fully produced with {name}'s touring crew, staging and team",
      "Lifetime VIP box and first-row access at every {name} show worldwide you attend, plus official after-party invites",
      "Lifetime 'Immortal' status: priority for every future {name} event, forever",
    ],
  },
  {
    name: "Stage Royal",
    price: 5000000,
    tagline: "{name} brings you on stage to perform alongside them at a real show.",
    benefits: [
      "Everything in The Immortal, plus:",
      "{name} brings you on stage to perform a live duet alongside them at a real arena show of your choice",
      "{name} dedicates a song to you live from the stage, with your name on the screens",
      "{name} celebrates your birthday or milestone live on stage — the whole arena sings with you",
      "Full tour-crew rehearsal and soundcheck with {name} before showtime",
      "Backstage-to-stage VIP weekend with {name} and their crew, with five-star travel for you and 25 guests",
      "Official stage photo and video package of your moment with {name}",
    ],
  },
  {
    name: "The Legend",
    price: 10000000,
    tagline: "The crowning tier: {name} headlines the event of your life, and you share the stage.",
    benefits: [
      "Everything in Stage Royal, plus:",
      "{name} headlines a fully produced concert staged around your birthday or milestone, anywhere on earth",
      "{name} performs and hosts your wedding, milestone birthday or gala as the centerpiece of the night",
      "You perform on stage together in front of a live audience of your choosing",
      "A private dinner and a one-on-one day with {name} before the event",
      "Lifetime unlimited access: front-row seats, after-parties and backstage at every {name} show worldwide",
      "A devoted lifelong liaison from {name}'s team for you and your family",
      "{name} announces your milestone, cause or project at their next major public event",
    ],
  },
  {
    name: "The Eternal",
    price: 15000000,
    tagline: "The absolute crown: {name} headlines a stadium built around your story, forever yours.",
    benefits: [
      "Everything in The Legend, plus:",
      "{name} headlines a full stadium concert produced entirely around you and your milestone",
      "You perform on stage together at the stadium, with optional worldwide broadcast",
      "A custom stage, setlist and production built around your personal story",
      "{name} joins your family milestone every year — a standing lifetime invitation to a private annual performance",
      "Permanent 'never off the list' access for you and your family to every {name} show, tour and after-party worldwide",
      "{name} becomes a lifelong ambassador for your cause, foundation or legacy project, announced worldwide",
    ],
  },
];

// Display order used for premium tiers (kept after any base tiers).
export const PREMIUM_DISPLAY_ORDER_BASE = 100;

/**
 * Creates or updates every premium tier for one celebrity. Idempotent — safe
 * to run any number of times. Existing tiers are matched by name and updated,
 * so the full 15-rung ladder is always in sync.
 */
export async function upsertPremiumLevels(prisma, celebrity) {
  let created = 0;
  let updated = 0;
  for (let i = 0; i < PREMIUM_LEVELS.length; i++) {
    const t = PREMIUM_LEVELS[i];
    const levelData = {
      celebrityId: celebrity.id,
      name: t.name,
      description: t.tagline,
      benefits: t.benefits.map((line) => line.replaceAll("{name}", celebrity.name)).join("\n"),
      price: t.price,
      currency: "USD",
      displayOrder: PREMIUM_DISPLAY_ORDER_BASE + i,
      isActive: true,
    };
    const existing = await prisma.membershipLevel.findFirst({
      where: { celebrityId: celebrity.id, name: t.name },
    });
    if (existing) {
      await prisma.membershipLevel.update({ where: { id: existing.id }, data: levelData });
      updated += 1;
    } else {
      await prisma.membershipLevel.create({ data: levelData });
      created += 1;
    }
  }
  return { created, updated };
}