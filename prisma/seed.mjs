// Seed script for the Multi-Celebrity Fan Card Platform.
// - Seeds real celebrity communities (names, bios, categories, countries).
// - Creates membership levels for each community.
// - Deliberately creates ZERO fake fans: every counter shown on the site is
//   computed live from the database, so a fresh install shows a truthful
//   "starting state" until real registrations arrive.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function avatarDataUri(name, accent) {
  const ini = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="750" fill="url(#g)"/>
  <circle cx="300" cy="330" r="220" fill="url(#glow)"/>
  <circle cx="300" cy="330" r="150" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
  <text x="300" y="372" font-family="Arial, Helvetica, sans-serif" font-size="220" font-weight="700" text-anchor="middle" fill="#ffffff">${ini}</text>
  <rect x="120" y="600" width="360" height="6" rx="3" fill="rgba(255,255,255,0.8)"/>
  <text x="300" y="660" font-family="Arial, Helvetica, sans-serif" font-size="34" letter-spacing="6" text-anchor="middle" fill="rgba(255,255,255,0.95)">OFFICIAL FAN</text>
  <text x="300" y="700" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="3" text-anchor="middle" fill="rgba(255,255,255,0.6)">MEMBER COMMUNITY</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function coverDataUri(accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="55%" stop-color="#27104a"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="600" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.05)">
    <circle cx="200" cy="150" r="120"/>
    <circle cx="1400" cy="450" r="180"/>
    <circle cx="1100" cy="120" r="70"/>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const celebrities = [
  {
    name: "Taylor Swift",
    slug: "taylor-swift",
    category: "Musician",
    country: "United States",
    city: "Nashville, Tennessee",
    profession: "Singer-Songwriter",
    bio: "Taylor Swift is one of the best-selling music artists of all time. Known for narrative songwriting across country, pop, and indie genres, she has released multiple record-breaking albums and has won numerous Grammy Awards. Her Eras Tour became the highest-grossing concert tour in history.",
    shortBio: "Grammy-winning singer-songwriter and one of the best-selling music artists in history.",
    accentColor: "#ef4444",
    isFeatured: true,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/taylorswift/",
      x: "https://x.com/taylorswift13",
      youtube: "https://www.youtube.com/taylorswift",
      tiktok: "https://www.tiktok.com/@taylorswift",
      official: "https://www.taylorswift.com",
    }),
    memberships: [
      { name: "Swiftie Member", description: "Official verified fan card and community access.", price: null },
      { name: "Swiftie Gold", description: "Gold fan card, priority news, and exclusive digital content.", price: 19.99 },
      { name: "Swiftie VIP", description: "VIP recognition card with premium community status.", price: 49.99 },
    ],
  },
  {
    name: "Cristiano Ronaldo",
    slug: "cristiano-ronaldo",
    category: "Athlete",
    country: "Portugal",
    city: "Madeira / Riyadh",
    profession: "Professional Footballer",
    bio: "Cristiano Ronaldo is one of the greatest footballers in history. The all-time leading goalscorer in men's international football, he has won league titles in England, Spain, and Italy along with five Ballon d'Or awards. Ronaldo is celebrated for his longevity, athleticism, and scoring records.",
    shortBio: "Five-time Ballon d'Or winner and the all-time top scorer in men's international football.",
    accentColor: "#22c55e",
    isFeatured: true,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/cristiano/",
      x: "https://x.com/Cristiano",
      facebook: "https://www.facebook.com/Cristiano",
      official: "https://www.cristianoronaldo.com",
    }),
    memberships: [
      { name: "CR7 Member", description: "Official CR7 fan card and community news.", price: null },
      { name: "CR7 Premium", description: "Premium card, club updates, and fan features.", price: 15.99 },
      { name: "CR7 Icon", description: "Icon status card for the most devoted supporters.", price: 39.99 },
    ],
    currency: "EUR",
  },
  {
    name: "Beyoncé",
    slug: "beyonce",
    category: "Musician",
    country: "United States",
    city: "Houston, Texas",
    profession: "Singer, Songwriter & Performer",
    bio: "Beyoncé is a transformative force in music and culture. From Destiny's Child to a solo career defined by boundary-pushing albums, she has won more Grammy Awards than any other artist in history. Her live performances and visual albums set the standard for modern superstardom.",
    shortBio: "Most-awarded artist in Grammy history and one of the most influential performers of her generation.",
    accentColor: "#f59e0b",
    isFeatured: true,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/beyonce/",
      x: "https://x.com/Beyonce",
      facebook: "https://www.facebook.com/beyonce",
      official: "https://www.beyonce.com",
    }),
    memberships: [
      { name: "The Beyhive", description: "Official Beyhive membership with verified fan card.", price: null },
      { name: "Beyhive Gold", description: "Gold recognition and exclusive community perks.", price: 24.99 },
      { name: "Renaissance VIP", description: "Premium VIP card for dedicated fans.", price: 59.99 },
    ],
    currency: "USD",
  },
  {
    name: "Virat Kohli",
    slug: "virat-kohli",
    category: "Athlete",
    country: "India",
    city: "Delhi",
    profession: "Cricketer",
    bio: "Virat Kohli is considered among the greatest batters in cricket history. With over 70 international centuries and more runs than any Indian before him, he has captained India across formats and is a global sports icon known for aggression, fitness, and consistency.",
    shortBio: "One of cricket's greatest batters and a global sporting icon from India.",
    accentColor: "#3b82f6",
    isFeatured: true,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/virat.kohli/",
      x: "https://x.com/imVkohli",
      facebook: "https://www.facebook.com/virat.kohli",
    }),
    memberships: [
      { name: "Kohli Fan", description: "Official fan membership with verified card.", price: null },
      { name: "Kohli Premium", description: "Premium card with match-day news and content.", price: 499 },
      { name: "King Kohli VIP", description: "VIP status for the most loyal supporters.", price: 1499 },
    ],
    currency: "INR",
  },
  {
    name: "Dwayne Johnson",
    slug: "dwayne-johnson",
    category: "Actor",
    country: "United States",
    city: "Hayward, California",
    profession: "Actor & Producer",
    bio: "Dwayne 'The Rock' Johnson rose from professional wrestling to become one of Hollywood's highest-paid actors. Known for blockbuster franchises such as 'Jumanji', 'Fast & Furious', and 'Moana', he is also a producer and one of the most followed celebrities in the world.",
    shortBio: "Global superstar actor and producer, formerly one of the greatest professional wrestlers.",
    accentColor: "#0ea5e9",
    isFeatured: false,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/therock/",
      x: "https://x.com/TheRock",
      facebook: "https://www.facebook.com/DwayneJohnson",
      youtube: "https://www.youtube.com/@therock",
    }),
    memberships: [
      { name: "Rock Member", description: "Official fan card and the Brahma Bull community.", price: null },
      { name: "People's Champion", description: "Premium recognition with exclusive content.", price: 14.99 },
      { name: "Final Boss VIP", description: "VIP status card for dedicated superfans.", price: 44.99 },
    ],
    currency: "USD",
  },
  {
    name: "Selena Gomez",
    slug: "selena-gomez",
    category: "Musician",
    country: "United States",
    city: "Grand Prairie, Texas",
    profession: "Singer, Actress & Producer",
    bio: "Selena Gomez is a singer, actress, and producer who became one of the most influential figures in pop culture. From Disney to chart-topping albums, she has also built Rare Beauty and works as an advocate for mental health, making her one of the most followed women on social media.",
    shortBio: "Multi-platinum pop star, actress, and entrepreneur with a global platform.",
    accentColor: "#ec4899",
    isFeatured: false,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/selenagomez/",
      x: "https://x.com/selenagomez",
      facebook: "https://www.facebook.com/Selena",
      youtube: "https://www.youtube.com/@SelenaGomez",
    }),
    memberships: [
      { name: "Selenator", description: "Official Selenators membership and fan card.", price: null },
      { name: "Selenator Gold", description: "Gold fan card with community perks.", price: 17.99 },
      { name: "Rare VIP", description: "Premium VIP status inside the community.", price: 54.99 },
    ],
    currency: "USD",
  },
  {
    name: "Lionel Messi",
    slug: "lionel-messi",
    category: "Athlete",
    country: "Argentina",
    city: "Rosario / Miami",
    profession: "Professional Footballer",
    bio: "Lionel Messi is widely regarded as one of the greatest footballers of all time. An eight-time Ballon d'Or winner, he led Argentina to the 2022 FIFA World Cup and has broken scoring records at Barcelona and across all of European club football.",
    shortBio: "Eight-time Ballon d'Or winner and 2022 World Cup champion.",
    accentColor: "#8b5cf6",
    isFeatured: false,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/leomessi/",
      facebook: "https://www.facebook.com/leomessi",
      official: "https://messi.com",
    }),
    memberships: [
      { name: "Culé Member", description: "Official fan membership with verified card.", price: null },
      { name: "Goat Premium", description: "Premium card with exclusive fan features.", price: 18.99 },
      { name: "La Pulga VIP", description: "VIP status for superfans worldwide.", price: 49.99 },
    ],
    currency: "EUR",
  },
  {
    name: "Billie Eilish",
    slug: "billie-eilish",
    category: "Musician",
    country: "United States",
    city: "Los Angeles, California",
    profession: "Singer-Songwriter",
    bio: "Billie Eilish is a multi-Grammy-winning singer-songwriter who redefined modern pop. Her debut album 'When We All Fall Asleep, Where Do We Go?' topped charts worldwide, and her music has earned her several Album of the Year honors and an Academy Award for 'What Was I Made For?'.",
    shortBio: "Multi-award-winning pop innovator and global cultural phenomenon.",
    accentColor: "#10b981",
    isFeatured: false,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/billieeilish/",
      x: "https://x.com/billieeilish",
      youtube: "https://www.youtube.com/@BillieEilish",
      tiktok: "https://www.tiktok.com/@billieeilish",
      official: "https://www.billieeilish.com",
    }),
    memberships: [
      { name: "Fan Member", description: "Official fan card and community access.", price: null },
      { name: "Gold Member", description: "Gold fan card with priority content.", price: 13.99 },
      { name: "Ocean Eyes VIP", description: "VIP recognition card for committed fans.", price: 42.99 },
    ],
    currency: "USD",
  },
  {
    name: "Johnny Depp",
    slug: "johnny-depp",
    category: "Actor",
    country: "United States",
    city: "Los Angeles, California",
    profession: "Actor & Producer",
    bio: "Johnny Depp is an award-winning actor and producer known for his transformative roles across Hollywood. His global fan community spans the USA, Europe, UK, Canada, China, India, Australia, and beyond.",
    shortBio: "Award-winning actor and producer with a worldwide fan community.",
    accentColor: "#0ea5e9",
    isFeatured: true,
    socialLinks: JSON.stringify({
      instagram: "https://www.instagram.com/johnnydepp/",
      x: "https://x.com/JohnnyDepp",
      youtube: "https://www.youtube.com/@JohnnyDeppOfficial",
      facebook: "https://www.facebook.com/JohnnyDepp",
      official: "https://www.johnnydepp.com",
    }),
    memberships: [
      { name: "Member", description: "Official fan card for every fan.", price: null },
      { name: "Gold", description: "Gold card design + priority community news.", price: 14.99 },
      { name: "VIP", description: "Exclusive VIP design and premium support.", price: 44.99 },
    ],
    currency: "USD",
  },
];

async function main() {
  const started = Date.now();
  let created = 0;
  let updated = 0;

  for (const c of celebrities) {
    const profile = avatarDataUri(c.name, c.accentColor);
    const cover = coverDataUri(c.accentColor);

    const existing = await prisma.celebrity.findUnique({ where: { slug: c.slug } });
    const data = {
      slug: c.slug,
      name: c.name,
      category: c.category,
      country: c.country,
      city: c.city,
      profession: c.profession,
      bio: c.bio,
      shortBio: c.shortBio,
      profileImage: profile,
      coverImage: cover,
      accentColor: c.accentColor,
      isFeatured: c.isFeatured,
      isActive: true,
      socialLinks: c.socialLinks,
      cardDesign: JSON.stringify({
        primary: c.accentColor,
        accent: "#f59e0b",
        gradientFrom: c.accentColor,
        gradientTo: "#0b0c10",
        showPhoto: true,
        watermark: "OFFICIAL FAN MEMBER",
        badgeText: "FAN CARD",
      }),
    };

    let celebrity;
    if (existing) {
      celebrity = await prisma.celebrity.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      celebrity = await prisma.celebrity.create({ data });
      created += 1;
    }

    // Upsert membership levels
    for (let i = 0; i < c.memberships.length; i++) {
      const m = c.memberships[i];
      const levelData = {
        celebrityId: celebrity.id,
        name: m.name,
        description: m.description,
        benefits: m.description,
        price: m.price ?? null,
        currency: c.currency ?? "USD",
        displayOrder: i,
        isActive: true,
      };
      const level = await prisma.membershipLevel.findFirst({
        where: { celebrityId: celebrity.id, name: m.name },
      });
      if (level) {
        await prisma.membershipLevel.update({ where: { id: level.id }, data: levelData });
      } else {
        await prisma.membershipLevel.create({ data: levelData });
      }
    }
  }

  const totals = await Promise.all([
    prisma.celebrity.count(),
    prisma.fan.count(),
    prisma.fanCard.count(),
  ]);

  console.log(`Seeded ${celebrities.length} celebrity communities in ${Date.now() - started}ms.`);
  console.log(`Created: ${created}, updated: ${updated}.`);
  console.log(`Database now holds: ${totals[0]} celebrities, ${totals[1]} fans, ${totals[2]} fan cards.`);
  console.log("Note: no fake fans were inserted — live counters reflect real data only.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });