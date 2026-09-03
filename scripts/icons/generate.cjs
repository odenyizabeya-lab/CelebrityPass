// Generates all CelebrityPass app icon assets (PNG sizes + SVG sources)
// used by the Capacitor Android project and PWA metadata.
// Run: node scripts/icons/generate.mjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const out = path.join(process.cwd(), "public", "icons");
const androidPath = path.join(process.cwd(), "android", "app", "src", "main", "res");
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync("android")) fs.mkdirSync(androidPath, { recursive: true });

// Brand colours (match the web app's primary-600 -> accent-500 gradient).
const GRAD_START = "#7c3aed"; // primary-600 (violet-600)
const GRAD_END = "#f59e0b"; // accent-500 (amber-500)
const MARK = "#ffffff";

// Full icon with gradient background + "CP" monogram.
const iconSvg = (size, opts = {}) => {
  const pad = opts.pad ?? size * 0.08; // optional safe padding
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRAD_START}"/>
      <stop offset="1" stop-color="${GRAD_END}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <text x="50%" y="52%" font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${size * 0.5}" fill="${MARK}" text-anchor="middle" dominant-baseline="middle">CP</text>
</svg>`;
};

// Adaptive foreground: transparent background, gradient circle/swirl in the
// center safe zone (80% of icon), leaving room for masking.
const foregroundSvg = (size) => {
  const sc = size * 0.62; // safe-zone content size (Android masks to 66%)
  const r = size * 0.28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRAD_START}"/>
      <stop offset="1" stop-color="${GRAD_END}"/>
    </linearGradient>
  </defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.40}" fill="url(#fg)"/>
  <text x="50%" y="${size * 0.525}" font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${size * 0.42}" fill="${MARK}" text-anchor="middle" dominant-baseline="middle">CP</text>
</svg>`;
};

// Adaptive background: full-bleed solid brand colour.
const backgroundSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${GRAD_START}"/>
</svg>`;

// Monochrome (themed icons).
const monochromeSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${size * 0.18}" y="${size * 0.24}" width="${size * 0.64}" height="${size * 0.52}" rx="${size * 0.08}" fill="white"/>
  <text x="50%" y="55%" font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${size * 0.4}" fill="black" text-anchor="middle" dominant-baseline="middle">CP</text>
</svg>`;

async function raster(gen, size, file) {
  const buf = Buffer.from(gen(size));
  const png = await sharp(buf).resize(size, size).png().toBuffer();
  fs.writeFileSync(file, png);
  console.log("wrote", path.relative(process.cwd(), file));
}

async function writeSvg(gen, file) {
  fs.writeFileSync(file, gen(512));
  console.log("wrote", path.relative(process.cwd(), file));
}

async function main() {
  // Source SVGs (also useful directly).
  await writeSvg(iconSvg, path.join(out, "icon.svg"));
  await writeSvg(foregroundSvg, path.join(out, "icon-foreground.svg"));
  await writeSvg(backgroundSvg, path.join(out, "icon-background.svg"));
  await writeSvg(monochromeSvg, path.join(out, "icon-monochrome.svg"));

  // PWA / web icons.
  await raster(iconSvg, 192, path.join(out, "icon-192.png"));
  await raster(iconSvg, 512, path.join(out, "icon-512.png"));
  await raster(iconSvg, 180, path.join(out, "apple-touch-icon.png"));

  // Android mipmap launcher icons (legacy): icon.png for each density.
  const legacyDirs = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ];
  for (const [dir, size] of legacyDirs) {
    const d = path.join(androidPath, dir);
    fs.mkdirSync(d, { recursive: true });
    await raster(iconSvg, size, path.join(d, "ic_launcher.png"));
    await raster(iconSvg, size, path.join(d, "ic_launcher_round.png"));
  }

  // Android adaptive icon layers (foreground/background/monochrome). Adaptive
  // icons are 108dp, so per-density px = 108 * density.
  const densityScale = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const adaptiveLayers = [
    ["ic_launcher_foreground.png", foregroundSvg],
    ["ic_launcher_background.png", backgroundSvg],
    ["ic_launcher_monochrome.png", monochromeSvg],
  ];
  for (const [file, gen] of adaptiveLayers) {
    for (const [dir, scale] of Object.entries(densityScale)) {
      const d = path.join(androidPath, "mipmap-" + dir);
      fs.mkdirSync(d, { recursive: true });
      await raster(gen, Math.round(108 * scale), path.join(d, file));
    }
  }

  // Android splash: 9-patch branded splash background (density icons handled by
  // the app theme; we provide a plain size-based splash icon set).
  console.log("All icons generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});