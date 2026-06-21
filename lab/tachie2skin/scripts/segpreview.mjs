// Visualize background removal: removed bg → magenta. node scripts/segpreview.mjs <png> [tol]
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { decodePNG } from "./pngdec.mjs";
import { removeBackground } from "../web/projectcore.mjs";

const path = process.argv[2], tol = process.argv[3] ? +process.argv[3] : 110;
const { data, width: W, height: H } = decodePNG(path);
removeBackground(data, W, H, tol);
const s = Math.max(1, Math.round(Math.max(W, H) / 360));
const w = Math.floor(W / s), h = Math.floor(H / s);
const out = new Uint8ClampedArray(w * h * 4);
let op = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const o = ((y * s) * W + (x * s)) * 4, q = (y * w + x) * 4;
  if (data[o + 3] < 128) { out[q] = 255; out[q + 1] = 0; out[q + 2] = 255; }
  else { out[q] = data[o]; out[q + 1] = data[o + 1]; out[q + 2] = data[o + 2]; op++; }
  out[q + 3] = 255;
}
console.log(path, `${W}x${H}`, "opaque", (100 * op / (w * h)).toFixed(1) + "%");
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; }
function chunk(t, d) { const ty = Buffer.from(t), l = Buffer.alloc(4), cc = Buffer.alloc(4); l.writeUInt32BE(d.length); cc.writeUInt32BE(crc32(Buffer.concat([ty, d]))); return Buffer.concat([l, ty, d, cc]); }
const raw = Buffer.alloc(h * (1 + w * 4)); let p = 0; for (let y = 0; y < h; y++) { raw[p++] = 0; for (let x = 0; x < w * 4; x++) raw[p++] = out[y * w * 4 + x]; }
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
const dst = `out/${basename(path, ".png")}_seg.png`;
writeFileSync(dst, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", dst);
