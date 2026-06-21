// Dev-only: write a crude "character" PNG (color bands: hair/skin/shirt/pants)
// with no dependencies, to smoke-test the IP-Adapter endpoint without a real 立绘.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 96, H = 160;
const bands = [
  [0.0, 0.22, [70, 42, 34]],    // hair (dark brown)
  [0.22, 0.34, [232, 185, 140]],// face (skin)
  [0.34, 0.66, [200, 48, 48]],  // shirt (red)
  [0.66, 0.86, [40, 58, 110]],  // pants (navy)
  [0.86, 1.0, [30, 30, 30]],    // shoes
];
function colorAt(y) {
  const t = y / H;
  for (const [a, b, c] of bands) if (t >= a && t < b) return c;
  return [255, 255, 255];
}

// Build raw RGB scanlines with filter byte 0 per row.
const raw = Buffer.alloc(H * (1 + W * 3));
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0;
  const [r, g, b] = colorAt(y);
  for (let x = 0; x < W; x++) { raw[o++] = r; raw[o++] = g; raw[o++] = b; }
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit, color type 2 (RGB)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("out/fixture.png", png);
console.log("wrote out/fixture.png", png.length, "bytes");
