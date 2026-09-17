const sharp = require("sharp");
const UA = { "User-Agent": "CelebrityPass/1.0 (bulk image provisioning)" };
(async () => {
  const u = "https://upload.wikimedia.org/wikipedia/commons/4/42/Finnish_President_Alexander_Stubb_arrives_to_the_South_Portico_of_the_White_House_for_a_meeting_with_President_Donald_Trump_%2854732037329%29_%28cropped_2%29.jpg";
  const res = await fetch(u, { headers: UA });
  const buf = Buffer.from(await res.arrayBuffer());
  for (const failOn of ["none", "truncated"]) {
    try {
      const out = await sharp(buf, { failOn }).rotate().resize({ width: 960, height: 1280, fit: "cover", position: "center" }).jpeg({ quality: 86 }).toBuffer();
      console.log(`failOn=${failOn} OK -> ${out.length} bytes`);
    } catch (e) {
      console.log(`failOn=${failOn} FAIL: ${e.message}`);
    }
  }
})();