import zlib from "node:zlib";

type RGB = [number, number, number];
type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";

/** Standard MC box-UV face rectangles for a part at skin offset (ox,oy). */
export function faceRects(ox: number, oy: number, w: number, h: number, d: number): Record<Face, [number, number, number, number]> {
  return {
    py: [ox + d, oy, w, d],
    ny: [ox + d + w, oy, w, d],
    nx: [ox, oy + d, d, h],
    pz: [ox + d, oy + d, w, h],
    px: [ox + d + w, oy + d, d, h],
    nz: [ox + d + w + d, oy + d, w, h],
  };
}

/** A 64×64 RGBA skin canvas with paint helpers and PNG export. */
export class SkinCanvas {
  readonly size = 64;
  readonly data = new Uint8Array(64 * 64 * 4); // transparent by default

  set(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || y < 0 || x >= 64 || y >= 64) return;
    const i = (y * 64 + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  rect(x: number, y: number, w: number, h: number, [r, g, b]: RGB, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, r, g, b, a);
  }

  /** Fill all six faces of a cuboid part with one color. */
  fillBox(ox: number, oy: number, w: number, h: number, d: number, color: RGB, a = 255): void {
    const f = faceRects(ox, oy, w, h, d);
    for (const r of Object.values(f)) this.rect(r[0], r[1], r[2], r[3], color, a);
  }

  toPNG(): Uint8Array {
    return encodePNG(this.data, 64, 64);
  }
}

// ---- minimal PNG encoder (RGBA, zlib) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

export function encodePNG(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = rgba[y * w * 4 + x]!;
  }
  const idat = zlib.deflateSync(raw);
  return new Uint8Array(Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}
