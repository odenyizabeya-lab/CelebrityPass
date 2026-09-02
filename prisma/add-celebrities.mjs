// One-off addition of requested celebrities.
// Idempotent: skips any celebrity whose slug already exists.
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

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const bioLines = {
  Actor:
    (name) => `${name} is a globally celebrated actor known for unforgettable performances across film and television. A worldwide fan community follows ${name} across the USA, UK, Canada, Europe, Asia and beyond — united here through official fan cards.`,
  Musician:
    (name) => `${name} is a chart-topping musician whose artistry resonates with fans around the world. From sold-out stages to devoted online fanbases, ${name} connects with supporters across the USA, UK, Canada, Europe, Asia and everywhere fans gather.`,
  Athlete:
    (name) => `${name} is a world-class athlete whose talent inspires millions across the globe. Fans from every continent support ${name} through official memberships and fan cards.`,
  Creator:
    (name) => `${name} is a leading digital creator whose content reaches fans in every corner of the world. The global community around ${name} celebrates official fan cards and memberships across the USA, UK, Canada, Europe, Asia and beyond.`,
  "Public Figure":
    (name) => `${name} is a public figure whose influence spans the world. Admirers across the USA, UK, Canada, Europe, Asia and many more countries come together in this official fan community.`,
};

const celebrities = [
  // ===== BTS (all 7 members + the group) =====
  { name: "BTS", category: "Musician", country: "South Korea", city: "Seoul", profession: "K-Pop Group", accent: "#9b5de5" },
  { name: "RM", category: "Musician", country: "South Korea", city: "Seoul", profession: "Rapper, Songwriter & Leader of BTS", accent: "#7b2ff7" },
  { name: "Jin", category: "Musician", country: "South Korea", city: "Seoul", profession: "Singer & Member of BTS", accent: "#4cc9f0" },
  { name: "Suga", category: "Musician", country: "South Korea", city: "Seoul", profession: "Rapper, Producer & Member of BTS", accent: "#4361ee" },
  { name: "J-Hope", category: "Musician", country: "South Korea", city: "Seoul", profession: "Rapper, Dancer & Member of BTS", accent: "#f72585" },
  { name: "Jimin", category: "Musician", country: "South Korea", city: "Seoul", profession: "Singer, Dancer & Member of BTS", accent: "#e63946" },
  { name: "V", category: "Musician", country: "South Korea", city: "Seoul", profession: "Singer & Member of BTS", accent: "#f4a261" },
  { name: "Jungkook", category: "Musician", country: "South Korea", city: "Seoul", profession: "Singer, Dancer & Member of BTS", accent: "#80b918" },

  // ===== Actors =====
  { name: "Jason Momoa", category: "Actor", country: "United States", city: "Nashoba County, Oklahoma", profession: "Actor & Filmmaker", accent: "#d62828" },
  { name: "Tom Cruise", category: "Actor", country: "United States", city: "Syracuse, New York", profession: "Actor & Producer", accent: "#0077b6" },
  { name: "Keanu Reeves", category: "Actor", country: "Canada", city: "Toronto, Ontario", profession: "Actor", accent: "#adb5bd" },
  { name: "Brad Pitt", category: "Actor", country: "United States", city: "Shawnee, Oklahoma", profession: "Actor & Producer", accent: "#f77f00" },
  { name: "Scarlett Johansson", category: "Actor", country: "United States", city: "Manhattan, New York", profession: "Actress & Singer", accent: "#ff006e" },
  { name: "Jenna Ortega", category: "Actor", country: "United States", city: "Coachella Valley, California", profession: "Actress", accent: "#3a0ca3" },
  { name: "Sydney Sweeney", category: "Actor", country: "United States", city: "Spokane, Washington", profession: "Actress & Producer", accent: "#bcb8b1" },
  { name: "Zendaya", category: "Actor", country: "United States", city: "Oakland, California", profession: "Actress & Singer", accent: "#f20089" },
  { name: "George Clooney", category: "Actor", country: "United States", city: "Lexington, Kentucky", profession: "Actor, Director & Producer", accent: "#5e548e" },
  { name: "Pierce Brosnan", category: "Actor", country: "Ireland", city: "Navan, County Meath", profession: "Actor & Producer", accent: "#22223b" },
  { name: "Sandra Bullock", category: "Actor", country: "United States", city: "Arlington, Virginia", profession: "Actress & Producer", accent: "#9a8c98" },
  { name: "Reese Witherspoon", category: "Actor", country: "United States", city: "New Orleans, Louisiana", profession: "Actress & Producer", accent: "#007f5f" },
  { name: "Jennifer Aniston", category: "Actor", country: "United States", city: "Sherman Oaks, California", profession: "Actress & Producer", accent: "#b5838d" },
  { name: "Nicole Kidman", category: "Actor", country: "Australia", city: "Honolulu, Hawaii", profession: "Actress & Producer", accent: "#6d597a" },
  { name: "Julia Roberts", category: "Actor", country: "United States", city: "Smyrna, Georgia", profession: "Actress & Producer", accent: "#cdb4db" },
  { name: "Angelina Jolie", category: "Actor", country: "United States", city: "Los Angeles, California", profession: "Actress & Filmmaker", accent: "#8d0801" },
  { name: "Jennifer Lopez", category: "Musician", country: "United States", city: "The Bronx, New York", profession: "Singer, Actress & Entertainer", accent: "#e07a5f" },
  { name: "Anne Hathaway", category: "Actor", country: "United States", city: "Brooklyn, New York", profession: "Actress", accent: "#6b705c" },
  { name: "Emma Watson", category: "Actor", country: "United Kingdom", city: "Paris, France", profession: "Actress & Activist", accent: "#3d5a80" },
  { name: "Charlize Theron", category: "Actor", country: "South Africa", city: "Benoni, Gauteng", profession: "Actress & Producer", accent: "#98c1d9" },
  { name: "Cameron Diaz", category: "Actor", country: "United States", city: "San Diego, California", profession: "Actress & Author", accent: "#ca6702" },
  { name: "Jennifer Lawrence", category: "Actor", country: "United States", city: "Indian Hills, Kentucky", profession: "Actress", accent: "#ffb703" },
  { name: "Milly Alcock", category: "Actor", country: "Australia", city: "Sydney, New South Wales", profession: "Actress", accent: "#e0afa0" },

  // ===== Musicians =====
  { name: "Sabrina Carpenter", category: "Musician", country: "United States", city: "Lehigh Valley, Pennsylvania", profession: "Singer-Songwriter & Actress", accent: "#e36414" },
  { name: "Adele", category: "Musician", country: "United Kingdom", city: "London, England", profession: "Singer-Songwriter", accent: "#526e2d" },
  { name: "Ariana Grande", category: "Musician", country: "United States", city: "Boca Raton, Florida", profession: "Singer-Songwriter & Actress", accent: "#bb8fce" },
  { name: "Drake", category: "Musician", country: "Canada", city: "Toronto, Ontario", profession: "Rapper, Singer & Producer", accent: "#ffd166" },
  { name: "Ed Sheeran", category: "Musician", country: "United Kingdom", city: "Framlingham, England", profession: "Singer-Songwriter", accent: "#d00000" },
  { name: "Riley Green", category: "Musician", country: "United States", city: "Jacksonville, Alabama", profession: "Country Singer-Songwriter", accent: "#b5838d" },
  { name: "Luke Bryan", category: "Musician", country: "United States", city: "Leesburg, Georgia", profession: "Country Singer", accent: "#386641" },
  { name: "Tim McGraw", category: "Musician", country: "United States", city: "Start, Louisiana", profession: "Country Singer & Actor", accent: "#6a040f" },
  { name: "James Blunt", category: "Musician", country: "United Kingdom", city: "Tidworth, England", profession: "Singer-Songwriter", accent: "#7f4f24" },
  { name: "Jerry Yan", category: "Actor", country: "Taiwan", city: "New Taipei City", profession: "Actor & Singer", accent: "#219ebc" },
  { name: "Kelsea Ballerini", category: "Musician", country: "United States", city: "Knoxville, Tennessee", profession: "Country Singer-Songwriter", accent: "#c9184a" },

  // ===== Athletes =====
  { name: "LeBron James", category: "Athlete", country: "United States", city: "Akron, Ohio", profession: "Professional Basketball Player", accent: "#ff5d8f" },

  // ===== Creators & Public Figures =====
  { name: "Elon Musk", category: "Public Figure", country: "United States", city: "Pretoria, South Africa", profession: "Entrepreneur & Visionary", accent: "#5c677d" },
  { name: "Oprah Winfrey", category: "Public Figure", country: "United States", city: "Kosciusko, Mississippi", profession: "Media Executive & Talk Show Host", accent: "#800080" },
  { name: "MrBeast", category: "Creator", country: "United States", city: "Wichita, Kansas", profession: "YouTuber & Philanthropist", accent: "#fb8500" },
  { name: "Kim Kardashian", category: "Public Figure", country: "United States", city: "Los Angeles, California", profession: "Media Personality & Entrepreneur", accent: "#9d4edd" },
  { name: "Donald Trump", category: "Public Figure", country: "United States", city: "Queens, New York", profession: "Businessman & Politician", accent: "#023047" },
  { name: "Gisele Bündchen", category: "Public Figure", country: "Brazil", city: "Horizontina, Rio Grande do Sul", profession: "Supermodel & Activist", accent: "#06a77d" },
];

async function main() {
  const started = Date.now();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of celebrities) {
    const slug = slugify(c.name);
    try {
      const existing = await prisma.celebrity.findUnique({ where: { slug } });
      if (existing) {
        skipped += 1;
        console.log(`SKIP  ${c.name} (already exists)`);
        continue;
      }

      const profile = avatarDataUri(c.name, c.accent);
      const cover = coverDataUri(c.accent);

      const celebrity = await prisma.celebrity.create({
        data: {
          slug,
          name: c.name,
          category: c.category,
          country: c.country,
          city: c.city ?? null,
          profession: c.profession,
          bio: bioLines[c.category]?.(c.name) ?? `${c.name} is celebrated worldwide.`,
          shortBio: `${c.profession} with a devoted global fan community.`,
          profileImage: profile,
          coverImage: cover,
          accentColor: c.accent,
          isFeatured: false,
          isActive: true,
          cardDesign: JSON.stringify({
            primary: c.accent,
            accent: "#f59e0b",
            gradientFrom: c.accent,
            gradientTo: "#0b0c10",
            showPhoto: true,
            watermark: "OFFICIAL FAN MEMBER",
            badgeText: "FAN CARD",
          }),
        },
      });

      const levels = [
        { name: "Member", description: "Official verified fan card and community access.", price: null },
        { name: "Gold", description: "Gold fan card, priority news, and exclusive digital content.", price: 14.99 },
        { name: "VIP", description: "VIP recognition card with premium community status.", price: 44.99 },
      ];
      for (let i = 0; i < levels.length; i++) {
        await prisma.membershipLevel.create({
          data: {
            celebrityId: celebrity.id,
            name: levels[i].name,
            description: levels[i].description,
            benefits: levels[i].description,
            price: levels[i].price,
            currency: "USD",
            displayOrder: i,
            isActive: true,
          },
        });
      }

      created += 1;
      console.log(`ADD   ${c.name}  -> /celebrity/${slug}`);
    } catch (e) {
      failed += 1;
      console.error(`FAIL  ${c.name}: ${e.message}`);
    }
  }

  const total = await prisma.celebrity.count();
  console.log(`\nDone in ${Date.now() - started}ms.`);
  console.log(`Added: ${created}, skipped (already existed): ${skipped}, failed: ${failed}.`);
  console.log(`Platform now has ${total} celebrity communities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });