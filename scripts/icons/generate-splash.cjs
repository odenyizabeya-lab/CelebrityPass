// Generates branded CelebrityPass Android splash images (dark violet background
// with centred "CP" monogram) for every density+orientation Capacitor expects.
// Run: node scripts/icons/generate-splash.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const androidPath = path.join(process.cwd(), "android", "app", "src", "main", "res");
const BG = "#1e1b2e"; // dark violet (matches app theme / adaptive icon background)
const MARK = "#ffffff";

const splashSvg = (w, h) => {
  const font = Math.min(w, h) * 0.34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <text x="50%" y="47%" font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${font}" fill="${MARK}" text-anchor="middle" dominant-baseline="middle">CP</text>
  <text x="50%" y="${h * 0.5 + font * 1.35}" font-family="Arial, Helvetica, sans-serif" font-weight="500"
        font-size="${Math.min(w, h) * 0.07}" letter-spacing="3" fill="#c4b5fd" text-anchor="middle"
        dominant-baseline="middle">CELEBRITYPASS</text>
</svg>`;
};

async function raster(w, h, file) {
  const png = await sharp(Buffer.from(splashSvg(w, h))).resize(w, h).png().toBuffer();
  fs.writeFileSync(file, png);
  console.log("wrote", path.relative(process.cwd(), file));
}

const sizes = {
  "drawable": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
};

async function main() {
  for (const [dir, [w, h]] of Object.entries(sizes)) {
    const d = path.join(androidPath, dir);
    fs.mkdirSync(d, { recursive: true });
    await raster(w, h, path.join(d, "splash.png"));
  }
  console.log("Splash images generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});