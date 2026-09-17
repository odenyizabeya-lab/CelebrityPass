const sharp = require("sharp");
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning)" };
const title = "Alexander_Stubb";
(async () => {
  const summary = await (await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + title, { headers: UA })).json();
  const src = String((summary?.originalimage ?? summary?.thumbnail)?.source ?? "");
  const thumb = String(summary?.thumbnail?.source ?? "");
  console.log("orig:", src);
  console.log("thumb:", thumb);
  for (const u of [src, thumb]) {
    if (!u) continue;
    const res = await fetch(u, { headers: UA });
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`\n${u.slice(0, 70)} -> ${buf.length} bytes, res=${res.status}, content-type=${res.headers.get("content-type")}`);
    console.log("  head:", buf.subarray(0, 16).toString("hex"));
    try {
      const meta = await sharp(buf).metadata();
      console.log("  format:", meta.format, meta.width + "x" + meta.height);
    } catch (e) {
      console.log("  sharp metadata FAIL:", e.message);
      try {
        const jpeg = await sharp(buf, { failOn: "none" }).jpeg().toBuffer();
        console.log("  re-encode with failOn=none OK ->", jpeg.length, "bytes");
      } catch (e2) {
        console.log("  re-encode FAIL too:", e2.message);
      }
    }
  }
  await sleep(200);
  // pageimages API
  const j = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&titles=" + title + "&prop=pageimages&piprop=original&format=json", { headers: UA })).json();
  const page = Object.values(j?.query?.pages ?? {})[0];
  console.log("\npageimages original:", page?.original?.source ?? "none");
  const pimg = page?.original?.source;
  if (pimg) {
    const res = await fetch(pimg, { headers: UA });
    const buf = Buffer.from(await res.arrayBuffer());
    console.log("  " + pimg + " -> " + buf.length + " bytes, type=" + res.headers.get("content-type"));
    try { const meta = await sharp(buf).metadata(); console.log("  format:", meta.format); } catch (e) { console.log("  FAIL:", e.message); }
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
})();