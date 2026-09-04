/*
 * CelebrityPass — Google Play phone screenshots generator.
 *
 * Produces 8 professional 1080x1920 (9:16 portrait) PNG screenshots, one per
 * real app feature, using the exact CelebrityPass brand and realistic UI that
 * mirrors the actual web app.
 *
 * Run: node scripts/play-screenshots.mjs   (from project root)
 * Output: /screenshots/*.png (PNG, 1080x1920)
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "screenshots");
fs.mkdirSync(OUT, { recursive: true });

// ---- Brand palette ----------------------------------------------------------
const INK_BG = "#0b0c10";
const INK_800 = "#13141b";
const INK_700 = "#1c1e29";
const INK_600 = "#272a38";
const GLASS_BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#f4f4f5";
const MUT = "#a1a1aa";
const DIM = "#6b7280";
const VIO = "#8b5cf6";
const VIO_L = "#a78bfa";
const MAG = "#d946ef";
const AMB = "#f59e0b";
const EM = "#34d399";
const EM_MUT = "rgba(52,211,153,0.12)";
const ROSE = "#fb7185";

const W = 1080;
const H = 1920;
const VW = 1080;
const VH = 1920;

// status bar / header / bottom nav heights
const ST_BAR = 110;
const HEADER = 104;
const NAV = 120;
const PAD = 44;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const bufferKB = (b) => Math.round((b.length || 0) / 1024);

const grdMain = `linear-gradient(100deg,#7c3aed 0%,#d946ef 55%,#f59e0b 130%)`;
const grdTextStops = `<stop offset="0%" stop-color="#c4b5fd"/><stop offset="50%" stop-color="#e879f9"/><stop offset="100%" stop-color="#fbbf24"/>`;

function defs() {
  return `
  <defs>
    <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/><stop offset="55%" stop-color="#d946ef"/><stop offset="130%" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="gt" x1="0" y1="0" x2="1" y2="0">${grdTextStops}</linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="46"/></filter>
  </defs>`;
}

function glowEllipse(cx, cy, rx, ry, color, op = 0.5) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${op}" filter="url(#soft)"/>`;
}

// Wordmark: CP monogram + "CelebrityPass"
function wordmark(x, y, size = 56) {
  const fs = Math.round(size * 0.72);
  return `
  <g>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.26}" fill="url(#gm)"/>
    <text x="${x + size / 2}" y="${y + size * 0.72}" font-family="Arial,Helvetica,sans-serif" font-size="${size * 0.5}" font-weight="900" fill="#fff" text-anchor="middle">CP</text>
    <text x="${x + size + 22}" y="${y + size * 0.74}" font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="800" fill="${TEXT}">Celebrity</text>
    <text x="${x + size + 22 + textWidth("Celebrity", fs)}" y="${y + size * 0.74}" font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="800" fill="url(#gt)">Pass</text>
  </g>`;
}

// rough text width estimate (px at given font-size) for centering layout
function textWidth(str, fs, weight = 400) {
  // approximate average glyph widths; good enough for layout guide
  let w = 0;
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    if (ch === " ") w += fs * 0.3;
    else if (code >= 65 && code <= 90) w += fs * 0.68; // uppercase
    else if (code >= 97 && code <= 122) w += fs * 0.55; // lowercase
    else if (code >= 48 && code <= 57) w += fs * 0.58;
    else if (".,!;:".includes(ch)) w += fs * 0.22;
    else w += fs * 0.5;
  }
  return Math.round(w);
}

// Bottom navigation bar
function bottomNav() {
  const items = [
    ["Home", "#ffffff", true],
    ["Discover", DIM, false],
    ["Search", DIM, false],
    ["Events", DIM, false],
    ["Profile", DIM, false],
  ];
  const n = items.length;
  const gap = (VW - PAD * 2) / n;
  let out = `<rect x="0" y="${VH - NAV}" width="${VW}" height="${NAV}" fill="${INK_BG}"/>
  <rect x="0" y="${VH - NAV}" width="${VW}" height="1" fill="${GLASS_BORDER}"/>`;
  const iconY = VH - NAV + 30;
  const labelY = VH - NAV + 86;
  items.forEach(([label, color, active], i) => {
    const cx = PAD + gap * i + gap / 2;
    let icon = "";
    if (label === "Home") icon = `<path d="M-16 -4 L0 -20 L16 -4 L16 8 a2 2 0 0 1 -2 2 L-14 10 a2 2 0 0 1 -2 -2 Z" fill="${color}"/>`;
    else if (label === "Discover") icon = `<circle cx="0" cy="-4" r="9" fill="none" stroke="${color}" stroke-width="3"/><path d="M6 6 L13 13" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    else if (label === "Search") icon = `<circle cx="-4" cy="-4" r="9" fill="none" stroke="${color}" stroke-width="3"/><path d="M3 3 L11 11" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    else if (label === "Events") icon = `<rect x="-13" y="-16" width="26" height="28" rx="5" fill="none" stroke="${color}" stroke-width="3"/><path d="M-13 -8 L13 -8 M-6 -20 L-6 -12 M6 -20 L6 -12" stroke="${color}" stroke-width="3"/>`;
    else if (label === "Profile") icon = `<circle cx="0" cy="-8" r="6" fill="none" stroke="${color}" stroke-width="3"/><path d="M-14 14 a14 14 0 0 1 28 0" fill="none" stroke="${color}" stroke-width="3"/>`;
    out += `<g transform="translate(${cx}, ${iconY})">${icon}</g>
    <text x="${cx}" y="${labelY}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="${active ? "800" : "600"}" fill="${color}" text-anchor="middle">${label}</text>`;
  });
  return out;
}

// Standard screen chrome (background + status bar + brand header). Returns svg.
function chrome() {
  return `
  <rect width="${VW}" height="${VH}" fill="${INK_BG}"/>
  ${defs()}
  ${glowEllipse(150, 120, 320, 220, "#7c3aed", 0.5)}
  ${glowEllipse(940, 150, 260, 200, "#d946ef", 0.38)}
  ${glowEllipse(W / 2, 1840, 380, 260, "#f59e0b", 0.28)}

  <!-- status bar -->
  <text x="${PAD}" y="${ST_BAR - 30}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="#e5e7eb">9:41</text>
  <g fill="#e5e7eb">
    <rect x="${VW - 150}" y="${ST_BAR - 48}" width="22" height="12" rx="3"/>
    <rect x="${VW - 118}" y="${ST_BAR - 44}" width="3" height="8" rx="1.5"/>
    <rect x="${VW - 109}" y="${ST_BAR - 44}" width="3" height="8" rx="1.5"/>
    <rect x="${VW - 100}" y="${ST_BAR - 44}" width="3" height="8" rx="1.5"/>
    <path d="M${VW - 70} ${ST_BAR - 44} L${VW - 70} ${ST_BAR - 34} L${VW - 46} ${ST_BAR - 34} L${VW - 46} ${ST_BAR - 44} Z" />
  </g>

  <!-- header -->
  <g transform="translate(${PAD}, ${ST_BAR + 22})">
    ${wordmark(0, 0)}
  </g>`;
}

// Generic rounded card
function card(x, y, w, h, bg = GLASS, border = GLASS_BORDER, radius = 26) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${bg}" stroke="${border}"/>`;
}

function pill(x, y, w, h, fill, text, tColor = "#fff", fs = 22, bold = true) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>
  <text x="${x + w / 2}" y="${y + h / 2 + 8}" font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="${bold ? 800 : 600}" fill="${tColor}" text-anchor="middle">${esc(text)}</text></g>`;
}

// gradient button (full width)
function gradButton(x, y, w, h, text, fs = 30) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#gm)"/>
  <text x="${x + w / 2}" y="${y + h / 2 + (fs / 2) * 0.7}" font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="800" fill="#fff" text-anchor="middle">${esc(text)}</text></g>`;
}

// status bar + header + bottom nav assembled with a content region.
function screen(content, { nav = true } = {}) {
  const topArea = chrome();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}">
  ${topArea}
  ${content}
  ${nav ? bottomNav() : ""}
</svg>`;
}

// ==========================================================================
// SCREEN 1 — HOME / DISCOVER
// ==========================================================================
function s1() {
  const cTop = ST_BAR + HEADER + 30; // content top
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 30}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700" fill="${MUT}">Good evening</text>`;
  c += `<text x="${PAD}" y="${cTop + 82}" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="900" fill="${TEXT}">Discover live <tspan fill="url(#gt)">entertainment</tspan></text>`;

  // search bar
  const sBarY = cTop + 128;
  c += `<rect x="${PAD}" y="${sBarY}" width="${VW - PAD * 2}" height="84" rx="42" fill="${INK_800}" stroke="${GLASS_BORDER}"/>
  <circle cx="${PAD + 52}" cy="${sBarY + 42}" r="16" fill="none" stroke="${MUT}" stroke-width="5"/><path d="M${PAD + 64} ${sBarY + 54} L${PAD + 82} ${sBarY + 72}" stroke="${MUT}" stroke-width="5" stroke-linecap="round"/>
  <text x="${PAD + 112}" y="${sBarY + 56}" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="${DIM}">Search artists, events, venues…</text>`;

  // chips
  const chips = ["Concerts", "Festivals", "Sports", "Theatre"];
  const chipY = sBarY + 118;
  let cx0 = PAD;
  for (const ch of chips) {
    const w2 = 44 + textWidth(ch, 26) + 44;
    c += pill(cx0, chipY, w2, 52, "rgba(255,255,255,0.05)", ch, TEXT, 26, 700);
    cx0 += w2 + 20;
  }

  // Featured section
  const featY = chipY + 96;
  c += `<text x="${PAD}" y="${featY}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="800" fill="${TEXT}">Featured events</text>`;
  c += `<text x="${VW - PAD}" y="${featY}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${VIO_L}" text-anchor="end">See all →</text>`;

  // hero featured card (horizontal)
  const hx = PAD;
  const hy = featY + 30;
  const hw = VW - PAD * 2;
  const hh = 300;
  c += card(hx, hy, hw, hh, INK_700, "rgba(139,92,246,0.35)", 28);
  c += `<rect x="${hx}" y="${hy}" width="${hw}" height="170" rx="28" fill="url(#gm)" opacity="0.92"/>`;
  c += `<text x="${hx + 34}" y="${hy + 62}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="#fff" opacity="0.9">The Eras Tour</text>`;
  c += `<text x="${hx + 34}" y="${hy + 112}" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="900" fill="#fff">Taylor Swift</text>`;
  c += `<text x="${hx + 34}" y="${hy + 152}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="#fff" opacity="0.92">Mercedes-Benz Stadium · Atlanta, US</text>`;
  // date pill on image
  c += pill(hx + hw - 160, hy + 24, 122, 56, "rgba(0,0,0,0.45)", "MAY 2", "#fff", 22, 800);
  c += `<circle cx="${hx + hw - 84}" cy="${hy + 236}" r="34" fill="#0b0c10" stroke="${GLASS_BORDER}"/><path d="M${hx + hw - 88} ${hy + 230} L${hx + hw - 54} ${hy + 236} L${hx + hw - 88} ${hy + 243} Z" fill="${EM}"/>`;
  c += `<text x="${hx + 34}" y="${hy + 224}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800" fill="${TEXT}">Tickets available</text>`;
  c += `<text x="${hx + 34}" y="${hy + 270}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="600" fill="${EM}">In 214 days · 8:00 PM</text>`;

  // Popular artists strip
  const popTitleY = hy + hh + 70;
  c += `<text x="${PAD}" y="${popTitleY}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="800" fill="${TEXT}">Popular artists</text>`;
  c += `<text x="${VW - PAD}" y="${popTitleY}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${VIO_L}" text-anchor="end">See all →</text>`;

  const artists = [
    ["BS", "BTS", "#8b5cf6", "K-pop"],
    ["TS", "Taylor", "#d946ef", "Pop"],
    ["BN", "Beyonce", "#f59e0b", "R&amp;B"],
    ["DR", "Drake", "#34d399", "Hip-hop"],
  ];
  const aY = popTitleY + 40;
  const aCardW = (VW - PAD * 2 - 40) / 4; // 4 across with 20 gaps => but let's space
  // simpler: horizontal scroll row of round avatars
  const avatarW = aCardW;
  let ax = PAD;
  artists.forEach(([init, name, color, cat], i) => {
    const cy = aY;
    c += `<circle cx="${ax + avatarW / 2}" cy="${cy + 58}" r="58" fill="${color}" opacity="0.9"/>`;
    c += `<text x="${ax + avatarW / 2}" y="${cy + 66}" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="900" fill="#fff" text-anchor="middle">${init}</text>`;
    c += `<text x="${ax + avatarW / 2}" y="${cy + 138}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="700" fill="${TEXT}" text-anchor="middle">${name}</text>`;
    c += `<text x="${ax + avatarW / 2}" y="${cy + 172}" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="${MUT}" text-anchor="middle">${esc(cat)}</text>`;
    ax += avatarW + 14;
  });

  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 2 — CELEBRITY SEARCH
// ==========================================================================
function s2() {
  const cTop = ST_BAR + HEADER + 30;
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 34}" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="900" fill="${TEXT}">Search</text>`;
  c += `<text x="${PAD}" y="${cTop + 78}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="${MUT}">Celebrities · artists · events · venues</text>`;

  // active search input
  const inY = cTop + 116;
  c += `<rect x="${PAD}" y="${inY}" width="${VW - PAD * 2}" height="84" rx="42" fill="${INK_800}" stroke="${VIO}" stroke-width="3"/>
  <circle cx="${PAD + 52}" cy="${inY + 42}" r="16" fill="none" stroke="${VIO_L}" stroke-width="5"/><path d="M${PAD + 64} ${inY + 54} L${PAD + 82} ${inY + 72}" stroke="${VIO_L}" stroke-width="5" stroke-linecap="round"/>
  <text x="${PAD + 112}" y="${inY + 56}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="600" fill="${TEXT}">ta</text>
  <rect x="${PAD + 112 + textWidth("ta", 32)}" y="${inY + 34}" width="3" height="20" fill="${VIO_L}"/>`;

  // live suggestions
  const sugY = inY + 128;
  c += `<text x="${PAD}" y="${sugY}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="800" fill="${VIO_L}">Top suggestions</text>`;
  const sugs = [
    ["Taylor Swift", "Artist · Pop", "#d946ef", "TS"],
    ["Tate McRae", "Artist · Pop", "#8b5cf6", "TM"],
    ["Travis Scott", "Artist · Hip-hop", "#f59e0b", "TS"],
    ["Ariana Grande", "Artist · Pop", "#34d399", "AG"],
  ];
  let sy0 = sugY + 36;
  sugs.forEach(([name, sub, color, init]) => {
    c += card(PAD, sy0, VW - PAD * 2, 108, "rgba(255,255,255,0.035)", GLASS_BORDER, 24);
    c += `<circle cx="${PAD + 62}" cy="${sy0 + 54}" r="36" fill="${color}"/>`;
    c += `<text x="${PAD + 62}" y="${sy0 + 62}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="900" fill="#fff" text-anchor="middle">${init}</text>`;
    c += `<text x="${PAD + 116}" y="${sy0 + 44}" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="700" fill="${TEXT}">${name}</text>`;
    c += `<text x="${PAD + 116}" y="${sy0 + 78}" font-family="Arial,Helvetica,sans-serif" font-size="23" fill="${MUT}">${sub}</text>`;
    c += `<text x="${VW - PAD - 20}" y="${sy0 + 60}" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="${DIM}" text-anchor="end">›</text>`;
    sy0 += 124;
  });

  // recent searches chip row
  c += `<text x="${PAD}" y="${sy0 + 8}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="800" fill="${MUT}">Recent</text>`;
  let rx0 = PAD;
  ["BTS", "Drake", "Beyonce", "Ed Sheeran"].forEach((q) => {
    const w2 = 44 + textWidth(q, 26) + 40;
    c += pill(rx0, sy0 + 32, w2, 56, "rgba(255,255,255,0.05)", q, TEXT, 26, 700);
    rx0 += w2 + 18;
  });

  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 3 — ARTIST PROFILE
// ==========================================================================
function s3() {
  const cTop = ST_BAR + HEADER + 20;
  let c = "";

  // cover
  c += `<rect x="${PAD}" y="${cTop}" width="${VW - PAD * 2}" height="330" rx="30" fill="url(#gm)" opacity="0.95"/>`;
  c += `<rect x="${PAD}" y="${cTop}" width="${VW - PAD * 2}" height="330" rx="30" fill="${INK_BG}" opacity="0.15"/>`;
  // back arrow
  c += `<circle cx="${PAD + 44}" cy="${cTop + 44}" r="30" fill="rgba(0,0,0,0.35)"/><path d="M${PAD + 36} ${cTop + 44} L${PAD + 52} ${cTop + 34} M${PAD + 36} ${cTop + 44} L${PAD + 52} ${cTop + 54}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // artist name on cover
  c += `<text x="${PAD + 34}" y="${cTop + 260}" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="900" fill="#fff">Beyonce</text>`;
  c += `<text x="${PAD + 34}" y="${cTop + 306}" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="#fff" opacity="0.92">Singer &amp; Performer · United States</text>`;

  // verified badge next to name
  c += `<circle cx="${PAD + 34 + textWidth("Beyonce", 56) + 26}" cy="${cTop + 232}" r="18" fill="#fff"/><path d="M${PAD + 34 + textWidth("Beyonce", 56) + 14} ${cTop + 232} l8 10 l14 -20" stroke="${VIO}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  // stats row
  const statY = cTop + 382;
  c += card(PAD, statY, VW - PAD * 2, 150, "rgba(255,255,255,0.035)", GLASS_BORDER, 26);
  const statW = (VW - PAD * 2) / 3;
  [
    ["12.4M", "Fans"],
    ["124", "Events"],
    ["96", "Countries"],
  ].forEach(([num, lab], i) => {
    const sx = PAD + statW * i;
    c += `<text x="${sx + statW / 2}" y="${statY + 58}" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="900" fill="${TEXT}" text-anchor="middle">${num}</text>`;
    c += `<text x="${sx + statW / 2}" y="${statY + 100}" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="600" fill="${MUT}" text-anchor="middle">${lab}</text>`;
    if (i > 0) c += `<line x1="${sx}" y1="${statY + 30}" x2="${sx}" y2="${statY + 120}" stroke="${GLASS_BORDER}" stroke-width="2"/>`;
  });

  // categories + follow
  const catY = statY + 190;
  c += `<text x="${PAD}" y="${catY}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="800" fill="${TEXT}">About</text>`;
  c += `<text x="${PAD}" y="${catY + 44}" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="${MUT}">Pop &amp; R&amp;B icon known for record-breaking</text>`;
  c += `<text x="${PAD}" y="${catY + 80}" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="${MUT}">tours and chart-topping albums worldwide.</text>`;

  // upcoming events preview
  const upY = catY + 132;
  c += `<text x="${PAD}" y="${upY}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="800" fill="${TEXT}">Upcoming events</text>`;
  c += `<text x="${VW - PAD}" y="${upY}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${VIO_L}" text-anchor="end">See all →</text>`;
  const ulY = upY + 30;
  const events = [
    ["RENAISSANCE World Tour", "Las Vegas · US", "AUG 18", "8:00 PM"],
    ["RENAISSANCE World Tour", "Miami · US", "AUG 25", "7:30 PM"],
    ["RENAISSANCE World Tour", "New York · US", "SEP 02", "8:00 PM"],
  ];
  let ey = ulY;
  events.forEach(([name, loc, d, t]) => {
    c += card(PAD, ey, VW - PAD * 2, 132, "rgba(255,255,255,0.035)", GLASS_BORDER, 26);
    // date block
    c += `<rect x="${PAD + 18}" y="${ey + 20}" width="${VW - PAD * 2 - 36}" height="92" rx="20" fill="transparent"/>`;
    c += `<text x="${PAD + 44}" y="${ey + 52}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="900" fill="${MAG}" text-anchor="middle">${d.split(" ")[0]}</text>`;
    c += `<text x="${PAD + 44}" y="${ey + 84}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="${TEXT}" text-anchor="middle">${d.split(" ")[1]}</text>`;
    c += `<text x="${PAD + 96}" y="${ey + 52}" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="700" fill="${TEXT}">${name}</text>`;
    c += `<text x="${PAD + 96}" y="${ey + 88}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${MUT}">${loc}</text>`;
    c += `<text x="${VW - PAD - 26}" y="${ey + 52}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="${TEXT}" text-anchor="end">${d}</text>`;
    c += `<text x="${VW - PAD - 26}" y="${ey + 86}" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="${EM}" text-anchor="end">${t}</text>`;
    ey += 148;
  });

  // follow button
  gradButton(PAD, ey + 6, VW - PAD * 2, 86, "Follow artist", 30);

  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 4 — UPCOMING EVENTS
// ==========================================================================
function s4() {
  const cTop = ST_BAR + HEADER + 30;
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 32}" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="900" fill="${TEXT}">Upcoming events</text>`;
  c += `<text x="${PAD}" y="${cTop + 76}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="${MUT}">Real shows from verified providers</text>`;

  // filter chips
  const chips = ["All", "Concerts", "Festivals", "Near me"];
  const chipY = cTop + 116;
  let cx0 = PAD;
  chips.forEach((ch, i) => {
    const active = i === 0;
    const w2 = 40 + textWidth(ch, 26) + 40;
    c += pill(cx0, chipY, w2, 56, active ? "url(#gm)" : "rgba(255,255,255,0.05)", ch, active ? "#fff" : TEXT, 26, 700);
    cx0 += w2 + 18;
  });

  const listY = chipY + 92;
  const events = [
    { day: "02", mon: "SEP", name: "BTS — Permission to Dance", loc: "SoFi Stadium · Los Angeles, US", sta: "Sold out", stc: ROSE, ct: "T-26" },
    { day: "18", mon: "AUG", name: "RENAISSANCE World Tour", loc: "Accor Arena · Paris, FR", sta: "Available", stc: EM, ct: "T-12" },
    { day: "25", mon: "AUG", name: "Chrome Hearts Tour", loc: "Madison Square Garden · NY", sta: "Available", stc: EM, ct: "T-9" },
    { day: "02", mon: "OCT", name: "The Show: Live 2026", loc: "Sydney · Australia", sta: "On sale", stc: VIO_L, ct: "T-29" },
  ];
  let ey = listY;
  events.forEach((e) => {
    c += card(PAD, ey, VW - PAD * 2, 196, "rgba(255,255,255,0.035)", GLASS_BORDER, 26);
    // left date block
    c += `<rect x="${PAD + 22}" y="${ey + 30}" width="${VW - PAD * 2 - 44}" height="${196 - 60}" rx="18" fill="${INK_800}" stroke="${GLASS_BORDER}"/>`;
    c += `<g transform="translate(${PAD + 22 + (VW - PAD * 2 - 44) / 2}, ${ey + 30 + (196 - 60) / 2})">
      <text y="-16" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="900" fill="${MAG}" text-anchor="middle">${e.day}</text>
      <text y="20" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="${TEXT}" text-anchor="middle">${e.mon}</text>
    </g>`;
    // right info
    const ix = PAD + 132;
    c += `<text x="${ix}" y="${ey + 56}" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="700" fill="${TEXT}">${e.name}</text>`;
    c += `<text x="${ix}" y="${ey + 92}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${MUT}">${e.loc}</text>`;
    c += pill(ix, ey + 116, 40 + textWidth(e.sta, 22) + 36, 46, stAlpha(e.stc), e.sta, e.stc, 22, 700);
    c += `<text x="${VW - PAD - 26}" y="${ey + 150}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="${EM}" text-anchor="end">${e.ct}</text>`;
    ey += 212;
  });
  // bottom note
  c += `<text x="${PAD}" y="${ey + 18}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${DIM}">Only publicly announced, verified events are shown.</text>`;

  return screen(c, { title: null, nav: true });
}
function stAlpha(color) {
  return "rgba(255,255,255,0.06)";
}

// ==========================================================================
// SCREEN 5 — EVENT DETAILS
// ==========================================================================
function s5() {
  const cTop = ST_BAR + HEADER + 20;
  let c = "";
  // hero image
  c += `<rect x="${PAD}" y="${cTop}" width="${VW - PAD * 2}" height="360" rx="30" fill="url(#gm)" opacity="0.95"/>`;
  c += `<rect x="${PAD}" y="${cTop}" width="${VW - PAD * 2}" height="360" rx="30" fill="${INK_BG}" opacity="0.18"/>`;
  c += `<text x="${PAD + 32}" y="${cTop + 308}" font-family="Arial,Helvetica,sans-serif" font-size="50" font-weight="900" fill="#fff">BTS — Permission to Dance</text>`;
  c += `<text x="${PAD + 32}" y="${cTop + 352}" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="#fff" opacity="0.92">World Tour · Concert</text>`;
  // status pill
  c += pill(PAD + 32, cTop + 40, 170, 52, "rgba(0,0,0,0.4)", "● UPCOMING", "#9be8c4", 22, 800);

  // detail rows
  const dY = cTop + 410;
  const rows = [
    ["date", "Thu, Sep 02, 2026 · 8:00 PM"],
    ["loc", "SoFi Stadium, Los Angeles, CA, US"],
    ["tick", "Tickets on sale · from $89"],
    ["src", "Source: Ticketmaster Discovery"],
  ];
  let dy = dY;
  rows.forEach(([kind, txt]) => {
    let icon = "";
    if (kind === "date") icon = `<rect x="0" y="-12" width="26" height="28" rx="5" fill="none" stroke="${VIO_L}" stroke-width="4"/><path d="M0 -10 L26 -10 M7 -18 L7 -6 M19 -18 L19 -6" stroke="${VIO_L}" stroke-width="4"/>`;
    if (kind === "loc") icon = `<path d="M0 -18 a16 16 0 0 1 32 0 c0 14 -16 26 -16 26 c0 0 -16 -12 -16 -26 z" fill="none" stroke="${VIO_L}" stroke-width="4"/><circle cx="16" cy="-16" r="5" fill="${VIO_L}"/>`;
    if (kind === "tick") icon = `<rect x="-14" y="-16" width="34" height="26" rx="6" fill="none" stroke="${VIO_L}" stroke-width="4"/><circle cx="3" cy="-3" r="4" fill="${VIO_L}"/><path d="M8 -8 L20 4 M16 -8 L24 0" stroke="${VIO_L}" stroke-width="3"/>`;
    if (kind === "src") icon = `<circle cx="0" cy="-8" r="12" fill="none" stroke="${VIO_L}" stroke-width="4"/><path d="M-6 -8 l6 4 l8 -10" stroke="${VIO_L}" stroke-width="4" fill="none"/>`;
    c += `<g transform="translate(${PAD + 20}, ${dy + 66})">${icon}</g>`;
    c += `<text x="${PAD + 80}" y="${dy + 34}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="800" fill="${DIM}" text-transform="uppercase">${kind}</text>`;
    c += `<text x="${PAD + 80}" y="${dy + 74}" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="700" fill="${TEXT}">${txt}</text>`;
    c += `<line x1="${PAD}" y1="${dy + 104}" x2="${VW - PAD}" y2="${dy + 104}" stroke="${GLASS_BORDER}" stroke-width="2"/>`;
    dy += 118;
  });

  // actions
  const actY = dy + 14;
  gradButton(PAD, actY, VW - PAD * 2, 96, "Get Tickets", 32);
  c += `<rect x="${PAD}" y="${actY + 116}" width="${(VW - PAD * 2 - 24) / 2}" height="80" rx="40" fill="rgba(255,255,255,0.05)" stroke="${GLASS_BORDER}"/>
  <text x="${PAD + (VW - PAD * 2 - 24) / 4}" y="${actY + 116 + 50}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="700" fill="${TEXT}" text-anchor="middle">Add to calendar</text>`;
  c += `<rect x="${PAD + (VW - PAD * 2 - 24) / 2 + 24}" y="${actY + 116}" width="${(VW - PAD * 2 - 24) / 2}" height="80" rx="40" fill="rgba(255,255,255,0.05)" stroke="${GLASS_BORDER}"/>
  <text x="${PAD + (VW - PAD * 2 - 24) / 2 + 24 + (VW - PAD * 2 - 24) / 4}" y="${actY + 116 + 50}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="700" fill="${TEXT}" text-anchor="middle">Share event</text>`;

  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 6 — VENUE / LOCATION
// ==========================================================================
function s6() {
  const cTop = ST_BAR + HEADER + 30;
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 34}" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="900" fill="${TEXT}">Venue &amp; location</text>`;
  c += `<text x="${PAD}" y="${cTop + 78}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="${MUT}">Where the show happens</text>`;

  // map card (stylized)
  const mY = cTop + 128;
  c += card(PAD, mY, VW - PAD * 2, 420, INK_700, GLASS_BORDER, 28);
  // map grid lines
  c += `<g stroke="rgba(255,255,255,0.05)" stroke-width="2">`;
  for (let i = 1; i < 8; i++) c += `<line x1="${PAD + 40}" y1="${mY + i * 48}" x2="${VW - PAD - 40}" y2="${mY + i * 48}"/>`;
  for (let i = 1; i < 6; i++) c += `<line x1="${PAD + i * 160}" y1="${mY + 30}" x2="${PAD + i * 160}" y2="${mY + 390}"/>`;
  c += `</g>`;
  // roads
  c += `<path d="M${PAD} ${mY + 150} Q${PAD + 300} ${mY + 120} ${VW - PAD} ${mY + 200}" stroke="rgba(255,255,255,0.12)" stroke-width="18" fill="none" stroke-linecap="round"/>`;
  c += `<path d="M${PAD + 260} ${mY} Q${PAD + 300} ${mY + 200} ${PAD + 220} ${mY + 420}" stroke="rgba(255,255,255,0.1)" stroke-width="14" fill="none" stroke-linecap="round"/>`;
  // pin
  c += `<g transform="translate(${PAD + 120}, ${mY + 190})">
    <path d="M0 -60 a40 40 0 0 1 80 0 c0 34 -40 66 -40 66 c0 0 -40 -32 -40 -66 z" fill="url(#gm)" opacity="0.95"/>
    <circle cx="40" cy="-58" r="16" fill="#fff"/>
  </g>`;
  // venue label on map
  c += `<g transform="translate(${PAD + 120}, ${mY + 330})"><text font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="900" fill="#fff" text-anchor="middle">SoFi Stadium</text></g>`;

  // venue details card
  const vY = mY + 460;
  c += card(PAD, vY, VW - PAD * 2, 240, "rgba(255,255,255,0.035)", GLASS_BORDER, 28);
  c += `<text x="${PAD + 34}" y="${vY + 48}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800" fill="${TEXT}">SoFi Stadium</text>`;
  c += `<text x="${PAD + 34}" y="${vY + 88}" font-family="Arial,Helvetica,sans-serif" font-size="25" fill="${MUT}">1001 Stadium Drive, Inglewood, CA</text>`;
  c += `<text x="${PAD + 34}" y="${vY + 126}" font-family="Arial,Helvetica,sans-serif" font-size="25" fill="${MUT}">United States · 14:00 - 23:00</text>`;
  // capacity + doors
  c += `<rect x="${PAD + 34}" y="${vY + 150}" width="${(VW - PAD * 2 - 78) / 2}" height="70" rx="18" fill="${INK_800}" stroke="${GLASS_BORDER}"/>`;
  c += `<text x="${PAD + 34 + (VW - PAD * 2 - 78) / 4}" y="${vY + 190}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="800" fill="${TEXT}" text-anchor="middle">70,000 seats</text>`;
  c += `<rect x="${PAD + 44 + (VW - PAD * 2 - 78) / 2}" y="${vY + 150}" width="${(VW - PAD * 2 - 78) / 2}" height="70" rx="18" fill="${INK_800}" stroke="${GLASS_BORDER}"/>`;
  c += `<text x="${PAD + 44 + (VW - PAD * 2 - 78) / 2 + (VW - PAD * 2 - 78) / 4}" y="${vY + 190}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="800" fill="${TEXT}" text-anchor="middle">Doors 6:30 PM</text>`;

  // directions
  const dirY = vY + 280;
  c += `<text x="${PAD}" y="${dirY}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="800" fill="${TEXT}">Getting there</text>`;
  const dirs = [
    ["Car", "Parking available on site"],
    ["Metro", "2 min from Inglewood Station"],
    ["Rideshare", "Dedicated pickup zone"],
  ];
  let dy0 = dirY + 40;
  dirs.forEach(([t, s]) => {
    c += card(PAD, dy0, VW - PAD * 2, 92, "rgba(255,255,255,0.035)", GLASS_BORDER, 22);
    c += `<text x="${PAD + 30}" y="${dy0 + 58}" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="800" fill="${TEXT}">${t}</text>`;
    c += `<text x="${PAD + 210}" y="${dy0 + 58}" font-family="Arial,Helvetica,sans-serif" font-size="25" fill="${MUT}">${s}</text>`;
    dy0 += 108;
  });
  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 7 — TICKET INFORMATION
// ==========================================================================
function s7() {
  const cTop = ST_BAR + HEADER + 30;
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 34}" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="900" fill="${TEXT}">Tickets</text>`;
  c += `<text x="${PAD}" y="${cTop + 78}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="${MUT}">BTS — Permission to Dance</text>`;

  // availability banner
  const avY = cTop + 126;
  c += `<rect x="${PAD}" y="${avY}" width="${VW - PAD * 2}" height="120" rx="26" fill="${EM_MUT}" stroke="rgba(52,211,153,0.4)"/>`;
  c += `<circle cx="${PAD + 66}" cy="${avY + 60}" r="26" fill="${EM}"/><path d="M${PAD + 56} ${avY + 60} l8 8 l18 -20" stroke="#06281a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  c += `<text x="${PAD + 118}" y="${avY + 52}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800" fill="#9be8c4">Tickets available</text>`;
  c += `<text x="${PAD + 118}" y="${avY + 92}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#6ee7a8">Verified inventory from Ticketmaster</text>`;

  // ticket tiers
  const tiersY = avY + 170;
  c += `<text x="${PAD}" y="${tiersY}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="800" fill="${TEXT}">Select a ticket type</text>`;

  const tiers = [
    ["General Admission", "Floor standing", "$89", "8 left"],
    ["Reserved Seating", "Lower bowl · Sec 121", "$149", "Available"],
    ["VIP Experience", "Premium + early entry", "$289", "Limited"],
  ];
  let ty = tiersY + 30;
  tiers.forEach(([name, detail, price, av]) => {
    c += card(PAD, ty, VW - PAD * 2, 168, "rgba(255,255,255,0.035)", GLASS_BORDER, 26);
    c += `<text x="${PAD + 32}" y="${ty + 56}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800" fill="${TEXT}">${name}</text>`;
    c += `<text x="${PAD + 32}" y="${ty + 96}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${MUT}">${detail}</text>`;
    // select radio
    c += `<circle cx="${VW - PAD - 52}" cy="${ty + 60}" r="24" fill="none" stroke="${VIO_L}" stroke-width="4"/>`;
    // price + availability
    c += `<text x="${PAD + 32}" y="${ty + 150}" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="900" fill="${VIO_L}">${price}</text>`;
    c += `<text x="${VW - PAD - 52}" y="${ty + 150}" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="700" fill="${av === "Sold out" ? ROSE : EM}" text-anchor="middle">${av}</text>`;
    ty += 184;
  });

  // note
  const noteY = ty + 8;
  c += `<text x="${PAD}" y="${noteY}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${DIM}">Prices shown are the source's listed prices.</text>`;
  c += `<text x="${PAD}" y="${noteY + 38}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${DIM}">CelebrityPass links you to the official seller.</text>`;

  // GET TICKETS button at bottom (above nav)
  const btnY = VH - NAV - 150;
  gradButton(PAD, btnY, VW - PAD * 2, 100, "Get Tickets", 34);
  c += `<text x="${PAD + 40}" y="${btnY + 130}" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="${DIM}">Opens the legitimate ticket provider in a secure browser.</text>`;

  return screen(c, { title: null, nav: true });
}

// ==========================================================================
// SCREEN 8 — DISCOVERY EXPERIENCE (multi-provider search results)
// ==========================================================================
function s8() {
  const cTop = ST_BAR + HEADER + 30;
  let c = "";
  c += `<text x="${PAD}" y="${cTop + 34}" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="900" fill="${TEXT}">Event Discovery</text>`;
  c += `<text x="${PAD}" y="${cTop + 78}" font-family="Arial,Helvetica,sans-serif" font-size="27" fill="${MUT}">Search across every connected provider</text>`;

  // search bar (active query)
  const inY = cTop + 116;
  c += `<rect x="${PAD}" y="${inY}" width="${VW - PAD * 2}" height="84" rx="42" fill="${INK_800}" stroke="${VIO}" stroke-width="3"/>
  <circle cx="${PAD + 52}" cy="${inY + 42}" r="16" fill="none" stroke="${VIO_L}" stroke-width="5"/><path d="M${PAD + 64} ${inY + 54} L${PAD + 82} ${inY + 72}" stroke="${VIO_L}" stroke-width="5" stroke-linecap="round"/>
  <text x="${PAD + 112}" y="${inY + 56}" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="600" fill="${TEXT}">Ariana Grande</text>`;

  // result summary + providers
  const sumY = inY + 122;
  c += `<text x="${PAD}" y="${sumY}" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="800" fill="${TEXT}">Results for “Ariana Grande”</text>`;
  c += `<text x="${PAD}" y="${sumY + 34}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${MUT}">38 events found · 3 providers</text>`;
  // provider pills
  let px0 = PAD;
  [["Ticketmaster", EM], ["SeatGeek", VIO_L], ["Eventbrite", AMB]].forEach(([p, color]) => {
    const w2 = 40 + textWidth(p, 23) + 40;
    c += pill(px0, sumY + 50, w2, 48, "rgba(52,211,153,0.1)", "✓ " + p, color, 23, 700);
    px0 += w2 + 16;
  });

  // results list
  const resY = sumY + 128;
  const results = [
    { name: "Ariana Grande — Sweetener World Tour", loc: "Arena · London, UK", d: "OCT 14 · 8 PM", price: "from $94" },
    { name: "Ariana Grande European Tour", loc: "Olympiahalle · Munich, DE", d: "OCT 21 · 8 PM", price: "from $112" },
    { name: "Ariana Grande: Live in Concert", loc: "Accor Arena · Paris, FR", d: "OCT 28 · 7 PM", price: "from $88" },
  ];
  let ry = resY;
  results.forEach((r) => {
    c += card(PAD, ry, VW - PAD * 2, 190, "rgba(255,255,255,0.035)", GLASS_BORDER, 26);
    // thumb
    c += `<rect x="${PAD + 22}" y="${ry + 26}" width="118" height="118" rx="22" fill="url(#gm)"/>`;
    c += `<text x="${PAD + 22 + 59}" y="${ry + 26 + 72}" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="900" fill="#fff" text-anchor="middle">AG</text>`;
    c += `<text x="${PAD + 170}" y="${ry + 54}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="${TEXT}">${r.name}</text>`;
    // wrap long name? assume fits
    c += `<text x="${PAD + 170}" y="${ry + 92}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${MUT}">${r.loc}</text>`;
    c += `<text x="${PAD + 170}" y="${ry + 130}" font-family="Arial,Helvetica,sans-serif" font-size="23" fill="${DIM}">${r.d}</text>`;
    c += `<text x="${PAD + 170}" y="${ry + 162}" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" fill="${EM}">${r.price}</text>`;
    c += `<circle cx="${VW - PAD - 44}" cy="${ry + 90}" r="34" fill="url(#gm)"/><path d="M${VW - PAD - 56} ${ry + 90} l10 8 l22 -18" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    ry += 208;
  });

  // show more + trust note
  c += gradButton(PAD, ry + 6, VW - PAD * 2, 84, "Load more events", 29);
  c += `<text x="${PAD}" y="${ry + 122}" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="${DIM}">Duplicates across providers are merged automatically.</text>`;

  return screen(c, { title: null, nav: true });
}

const SCREENS = [
  ["01-home", s1],
  ["02-search", s2],
  ["03-artist", s3],
  ["04-events", s4],
  ["05-event-details", s5],
  ["06-venue", s6],
  ["07-tickets", s7],
  ["08-discovery", s8],
];

async function main() {
  for (const [name, fn] of SCREENS) {
    const svg = fn();
    const file = path.join(OUT, `${name}.png`);
    const buf = await sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
    fs.writeFileSync(file, buf);
    const meta = await sharp(file).metadata();
    console.log(`wrote ${path.relative(process.cwd(), file)}  (${meta.width}x${meta.height}, ${Math.round(bufferKB(buf))} kB)`);
  }
  console.log("Done — 8 screenshots generated.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
