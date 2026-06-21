// Assemble a front-view "paper doll" from a 64×64 skin atlas so the FRONT can be
// eyeballed headlessly (no WebGL). Lays out head/body/arms/legs front faces.
//   node scripts/paperdoll.mjs out/Klee.skin.png
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { decodePNG } from "./pngdec.mjs";
import { FACES } from "../web/mcatlas.mjs";

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/paperdoll.mjs <atlas.png>"); process.exit(1); }
const { data, width } = decodePNG(path);
const get = (x, y) => { const o = (y * width + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; };

// canvas 16×32 (arm4 + body8 + arm4 ; head8 ; legs)
const CW = 16, CH = 32, S = 12;
const W = CW * S, H = CH * S;
const img = new Uint8ClampedArray(W * H * 4);
const checker = (x, y) => ((((x / S) | 0) + ((y / S) | 0)) & 1) ? [224, 212, 196] : [206, 192, 174];

// place an atlas face [fx,fy,fw,fh] at canvas cell (cx,cy)
function place(face, cx, cy) {
  const [fx, fy, fw, fh] = face;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const [r, g, b, a] = get(fx + x, fy + y);
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const px = (cx + x) * S + sx, py = (cy + y) * S + sy, o = (py * W + px) * 4;
      if (a < 128) { const [cr, cg, cb] = checker(px, py); img[o] = cr; img[o + 1] = cg; img[o + 2] = cb; }
      else { img[o] = r; img[o + 1] = g; img[o + 2] = b; }
      img[o + 3] = 255;
    }
  }
}
// background checker first
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const [cr, cg, cb] = checker(px, py); const o = (py * W + px) * 4; img[o] = cr; img[o + 1] = cg; img[o + 2] = cb; img[o + 3] = 255; }

place(FACES.head.front, 4, 0);
place(FACES.body.front, 4, 8);
place(FACES.rightArm.front, 0, 8);
place(FACES.leftArm.front, 12, 8);
place(FACES.rightLeg.front, 4, 20);
place(FACES.leftLeg.front, 8, 20);

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; }
function chunk(t, d) { const ty = Buffer.from(t), l = Buffer.alloc(4), cc = Buffer.alloc(4); l.writeUInt32BE(d.length); cc.writeUInt32BE(crc32(Buffer.concat([ty, d]))); return Buffer.concat([l, ty, d, cc]); }
const raw = Buffer.alloc(H * (1 + W * 4)); let p = 0; for (let y = 0; y < H; y++) { raw[p++] = 0; for (let x = 0; x < W * 4; x++) raw[p++] = img[y * W * 4 + x]; }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
const out = join(dirname(path), basename(path, ".png") + ".front.png");
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", out);
