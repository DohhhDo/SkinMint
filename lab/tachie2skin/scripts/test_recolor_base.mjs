// Recolor a detailed base skin to target colors. node scripts/test_recolor_base.mjs assets/base_schoolgirl_0.png
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { decodePNG } from "./pngdec.mjs";
import { recolorSkin } from "../web/recolor.mjs";
import { encodeRGBA } from "../src/png.mjs";

const path = process.argv[2] || "assets/base_schoolgirl_0.png";
const { data } = decodePNG(path);

// Kurumi palette (from the VLM earlier)
const colors = {
  hair: [26, 26, 26], skin: [249, 245, 240], top: [24, 24, 28],
  bottom: [58, 82, 160], accent: [168, 0, 0], eye: [200, 28, 40],
  shirt: [236, 236, 240], shoe: [20, 20, 24],
};
const out = recolorSkin(data, colors);
const dst = `out/${basename(path, ".png")}.recolored.png`;
writeFileSync(dst, encodeRGBA(out, 64, 64));
console.log("wrote", dst);
