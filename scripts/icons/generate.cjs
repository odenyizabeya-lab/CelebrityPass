// Deprecated entry point. Kept so existing notes/scripts that call
// scripts/icons/generate.cjs don't break, but it no longer generates anything
// of its own.
//
// It USED to write a white "CP" monogram over every Android launcher mipmap,
// which silently replaced the CelebrityPass star mark with a different logo.
// The star is the brand mark, so this now just delegates to the single source
// of truth: scripts/generate-brand-assets.mjs, which reads
// public/icons/*.svg and regenerates the web icons, Play listing icon, Android
// adaptive/legacy/themed launcher layers and splash screens.
//
// Run: node scripts/generate-brand-assets.mjs
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const target = path.join(__dirname, "..", "generate-brand-assets.mjs");
console.warn(
  "scripts/icons/generate.cjs is deprecated and now delegates to " +
    "scripts/generate-brand-assets.mjs (CelebrityPass star mark).",
);

const result = spawnSync(process.execPath, [target], { stdio: "inherit" });
process.exit(result.status ?? 1);
