/**
 * Generates every rasterized CelebrityPass brand asset from the SVG sources.
 *
 * Run:  node scripts/generate-brand-assets.mjs   (from the repo root)
 * Deps: sharp (already in node_modules).
 *
 * Sources of truth:
 *   - public/icons/icon.svg          full app icon (squircle + glyph)
 *   - public/icons/icon-foreground.svg   glyph only, transparent
 *   - The star / stripe path data duplicated here match those SVGs.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const readSvg = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const STAR =
  "M256 86 L294.21 203.41 L417.68 203.47 L317.82 276.09 L355.92 393.53 L256 321 L156.08 393.53 L194.18 276.09 L94.32 203.47 L217.79 203.41 Z";
const STRIPE = "M110 297 L128 337 L402 215 L384 175 Z";
const WORDMARK_FNT = "900";
const TAGLINE_FNT = "500";

const out = (rel) => path.join(root, rel);

async function render(svg, file, w, h) {
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(w, h, { fit: "fill" })
    .png()
    .toFile(file);
  console.log("  wrote", path.relative(root, file), `${w}x${h}`);
}

function wordmark(cx, y, fs, anchor, gradId) {
  return `<text x="${cx}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-weight="${WORDMARK_FNT}" font-size="${fs}">` +
    `<tspan fill="#ffffff">Celebrity</tspan><tspan fill="url(#${gradId})">Pass</tspan></text>`;
}

function glyphGroup(cx, cy, scale) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-256 -256)">` +
    `<path fill="#ffffff" d="${STAR}"/><path fill="#fbbf24" d="${STRIPE}"/></g>`;
}

// ---------------------------------------------------------------------------
// 1. Web icons
// ---------------------------------------------------------------------------
async function webIcons() {
  console.log("Web icons:");
  const iconSvg = readSvg("public/icons/icon.svg");
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#d946ef"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>${glyphGroup(256, 256, 0.78)}</svg>`;

  await render(iconSvg, out("public/icons/icon-192.png"), 192, 192);
  await render(iconSvg, out("public/icons/icon-512.png"), 512, 512);
  await render(iconSvg, out("public/icons/apple-touch-icon.png"), 180, 180);
  await render(maskableSvg, out("public/icons/icon-maskable-512.png"), 512, 512);
}

// ---------------------------------------------------------------------------
// 2. Social preview images (OG + Twitter)
// ---------------------------------------------------------------------------
async function socialImages() {
  console.log("Social previews:");
  const og = (w, h, markCy) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="${h}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#1e1b2e"/><stop offset="1" stop-color="#2b1650"/></linearGradient>
      <linearGradient id="mark" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#d946ef"/></linearGradient>
      <linearGradient id="pass" x1="0" y1="0" x2="${w}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#f0abfc"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.35" r="0.55">
        <stop offset="0" stop-color="#7c3aed" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    <rect x="${w / 2 - 130}" y="${markCy - 130}" width="260" height="260" rx="57" fill="url(#mark)"/>
    ${glyphGroup(w / 2, markCy, 0.42)}
    ${wordmark(w / 2, markCy + 168, 78, "middle", "pass")}
    <text x="${w / 2}" y="${markCy + 236}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="${TAGLINE_FNT}" font-size="30" fill="#a78bfa">Official celebrity fan cards &amp; exclusive events</text>
    <text x="${w / 2}" y="${h - 46}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="${TAGLINE_FNT}" font-size="24" fill="#6b7280">celebritypass.app</text>
  </svg>`;

  await render(og(1200, 630, 230), out("src/app/opengraph-image.png"), 1200, 630);
  await render(og(1200, 675, 250), out("src/app/twitter-image.png"), 1200, 675);
}

// ---------------------------------------------------------------------------
// 3. Android mipmaps (launcher / round / foreground)
// ---------------------------------------------------------------------------
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function androidMipmaps() {
  console.log("Android mipmaps:");
  const iconSvg = readSvg("public/icons/icon.svg");
  const roundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath></defs>
    <g clip-path="url(#c)">${iconSvg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>$/i, "")}</g></svg>`;
  const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${glyphGroup(256, 256, 0.72)}</svg>`;

  for (const [d, size] of Object.entries(LAUNCHER)) {
    const dir = out(`android/app/src/main/res/mipmap-${d}`);
    await render(iconSvg, path.join(dir, "ic_launcher.png"), size, size);
    await render(roundSvg, path.join(dir, "ic_launcher_round.png"), size, size);
  }
  for (const [d, size] of Object.entries(FOREGROUND)) {
    await render(
      fgSvg,
      path.join(out(`android/app/src/main/res/mipmap-${d}`), "ic_launcher_foreground.png"),
      size,
      size,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Android splash screens
// ---------------------------------------------------------------------------
function splashSvg(w, h) {
  const portrait = h >= w;
  const base = Math.min(w, h);
  const ms = Math.round(base * (portrait ? 0.3 : 0.34));
  const ws = Math.max(30, Math.round(ms * 0.32));
  const ts = Math.max(15, Math.round(ms * 0.13));
  const cx = w / 2;

  const mark = (mx, my) =>
    `<rect x="${mx}" y="${my}" width="${ms}" height="${ms}" rx="${Math.round(ms * 0.22)}" fill="url(#markgrad)"/>` +
    glyphGroup(mx + ms / 2, my + ms / 2, (ms * 0.8) / 512);

  let body;
  if (portrait) {
    const markY = Math.round(h * 0.4 - ms / 2);
    const wordY = markY + ms + Math.round(ws * 1.25);
    const tagY = wordY + Math.round(ws * 0.62);
    body =
      mark(cx - ms / 2, markY) +
      wordmark(cx, wordY, ws, "middle", "pass") +
      `<text x="${cx}" y="${tagY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="${TAGLINE_FNT}" font-size="${ts}" fill="#a1a1aa">Official fan cards &amp; exclusive events</text>`;
  } else {
    const markY = Math.round(h / 2 - ms / 2);
    const markX = Math.round(w * 0.42 - ms / 2);
    const tx = markX + ms + Math.round(w * 0.035);
    const cy = h / 2;
    body =
      mark(markX, markY) +
      wordmark(tx, cy - Math.round(ws * 0.18), ws, "start", "pass") +
      `<text x="${tx}" y="${cy + Math.round(ws * 0.55)}" font-family="Arial, Helvetica, sans-serif" font-weight="${TAGLINE_FNT}" font-size="${ts}" fill="#a1a1aa">Official fan cards &amp; exclusive events</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="${h}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2b1650"/><stop offset="1" stop-color="#160f24"/></linearGradient>
      <linearGradient id="markgrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#d946ef"/></linearGradient>
      <linearGradient id="pass" x1="0" y1="0" x2="${w}" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#f0abfc"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.38" r="0.6">
        <stop offset="0" stop-color="#7c3aed" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    ${body}
  </svg>`;
}

const SPLASHES = [
  ["drawable", 480, 320],
  ["drawable-port-mdpi", 320, 480],
  ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 640, 960],
  ["drawable-port-xxhdpi", 960, 1600],
  ["drawable-port-xxxhdpi", 1280, 1920],
  ["drawable-land-mdpi", 480, 320],
  ["drawable-land-hdpi", 720, 480],
  ["drawable-land-xhdpi", 960, 640],
  ["drawable-land-xxhdpi", 1440, 960],
  ["drawable-land-xxxhdpi", 1920, 1280],
];

async function androidSplashes() {
  console.log("Android splashes:");
  for (const [folder, w, h] of SPLASHES) {
    await render(
      splashSvg(w, h),
      out(`android/app/src/main/res/${folder}/splash.png`),
      w,
      h,
    );
  }
}

// ---------------------------------------------------------------------------
async function main() {
  await webIcons();
  await socialImages();
  await androidMipmaps();
  await androidSplashes();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});