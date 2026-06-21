// Self-test the projection core in Node (no browser): build a synthetic 立绘,
// project it, encode the 64×64 atlas to PNG so the layout can be eyeballed.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { projectToAtlas } from "../web/projectcore.mjs";

const W = 200, H = 400;
const src = new Uint8ClampedArray(W * H * 4);
const set = (x, y, [r, g, b]) => { const o = (y * W + x) * 4; src[o] = r; src[o + 1] = g; src[o + 2] = b; src[o + 3] = 255; };

const WHITE = [255, 255, 255], HAIR = [70, 42, 34], SKIN = [232, 185, 140],
      SHIRT = [200, 48, 48], LEGS = [40, 58, 110], SHOE = [25, 25, 25];

for (let y = 0; y < H; y++) {
  const t = y / H;
  for (let x = 0; x < W; x++) {
    let c = WHITE;
    const inHead = x >= 80 && x < 120;
    const inTorso = x >= 70 && x < 130;
    const inLegs = x >= 78 && x < 122;
    if (t < 0.07 && inHead) c = HAIR;                          // hair (top of head)
    else if (t < 0.16 && inHead) c = SKIN;                     // face
    else if (t >= 0.16 && t < 0.50 && inTorso) {
      c = (x >= 86 && x < 114) ? SHIRT : SKIN;                 // center shirt, outer = bare arms
    } else if (t >= 0.50 && t < 0.95 && inLegs) c = LEGS;
    else if (t >= 0.95 && inLegs) c = SHOE;
    set(x, y, c);
  }
}

// --- assertions (run with: node scripts/test_project.mjs) ---
import { FACES } from "../web/mcatlas.mjs";
{
  const a = projectToAtlas(src, W, H, {}, { removeBg: true, bgTol: 30, quantize: false });
  const px = (f) => { const [x, y, w, h] = f; const o = ((y + (h >> 1)) * 64 + x + (w >> 1)) * 4; return [a[o], a[o + 1], a[o + 2]]; };
  const near = (c, t, tol = 55) => Math.hypot(c[0] - t[0], c[1] - t[1], c[2] - t[2]) < tol;
  const checks = [
    ["head.front≈skin", px(FACES.head.front), SKIN], ["head.top≈hair", px(FACES.head.top), HAIR],
    ["body.front≈shirt", px(FACES.body.front), SHIRT], ["rightArm.front≈skin", px(FACES.rightArm.front), SKIN],
    ["leftArm.front≈skin", px(FACES.leftArm.front), SKIN], ["rightLeg.front≈navy", px(FACES.rightLeg.front), LEGS],
    ["leftLeg.front≈navy", px(FACES.leftLeg.front), LEGS],
  ];
  let ok = true;
  for (const [n, got, want] of checks) { const p = near(got, want); ok = ok && p; console.log((p ? "PASS" : "FAIL"), n, "->", got.join(",")); }
  console.log(ok ? "ALL PASS\n" : "SOME FAILED\n");
}

const atlas = projectToAtlas(src, W, H, {}, { removeBg: true, bgTol: 30 });

// ---- encode RGBA PNG ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const N = 64;
const raw = Buffer.alloc(N * (1 + N * 4));
let o = 0;
for (let y = 0; y < N; y++) { raw[o++] = 0; for (let x = 0; x < N * 4; x++) raw[o++] = atlas[y * N * 4 + x]; }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("out/_test_atlas.png", png);
console.log("wrote out/_test_atlas.png");
