// End-to-end test on a real Genshin 立绘: decode → project → encode atlas.
//   node scripts/test_genshin.mjs assets/Klee.png [neck hip torsoCenter bgTol]
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { decodePNG } from "./pngdec.mjs";
import { projectToAtlas } from "../web/projectcore.mjs";
import { FACES } from "../web/mcatlas.mjs";

const [path, neck, hip, torsoCenter, bgTol, faceWidth, hairFace] = process.argv.slice(2);
if (!path) { console.error("usage: node scripts/test_genshin.mjs <png> [neck hip torsoCenter bgTol]"); process.exit(1); }

const { data, width, height } = decodePNG(path);
// If the input already has real transparency (a pre-cut matte), skip local bg removal.
let transparent = 0;
for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
const preCut = transparent / (width * height) > 0.05;
console.log(`decoded ${path} ${width}x${height}${preCut ? " (pre-cut matte → no local bg removal)" : ""}`);
const o = (x, y) => (y * width + x) * 4;
const corner = [data[o(0, 0)], data[o(0, 0) + 1], data[o(0, 0) + 2]];
console.log("corner color:", corner.join(","));

const guides = {
  neck: neck ? +neck : 0.16,
  hip: hip ? +hip : 0.50,
  torsoCenter: torsoCenter ? +torsoCenter : 0.50,
  ...(faceWidth ? { faceWidth: +faceWidth } : {}),
  ...(hairFace ? { hairFace: +hairFace } : {}),
};
const atlas = projectToAtlas(data, width, height, guides, { removeBg: !preCut, bgTol: bgTol ? +bgTol : 110 });

const px = (f) => { const [x, y, w, h] = f; const i = ((y + (h >> 1)) * 64 + x + (w >> 1)) * 4; return `${atlas[i]},${atlas[i + 1]},${atlas[i + 2]}`; };
for (const part of ["head", "body", "rightArm", "rightLeg"]) console.log(`${part}.front:`, px(FACES[part].front));

// encode RGBA atlas
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; }
function chunk(t, d) { const ty = Buffer.from(t), l = Buffer.alloc(4), cc = Buffer.alloc(4); l.writeUInt32BE(d.length); cc.writeUInt32BE(crc32(Buffer.concat([ty, d]))); return Buffer.concat([l, ty, d, cc]); }
const N = 64, raw = Buffer.alloc(N * (1 + N * 4));
let q = 0; for (let y = 0; y < N; y++) { raw[q++] = 0; for (let x = 0; x < N * 4; x++) raw[q++] = atlas[y * N * 4 + x]; }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
const out = `out/${basename(path, ".png")}.skin.png`;
writeFileSync(out, png);
console.log("wrote", out);
