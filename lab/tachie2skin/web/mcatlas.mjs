// Minecraft 64×64 skin atlas — face rectangles + a deterministic projector.
//
// Pure functions over flat RGBA buffers (Uint8ClampedArray, 4 bytes/px), so the
// SAME code runs in the browser (from canvas getImageData) and in Node (for
// tests). No canvas, no deps.
//
// Layout is the modern 1.8+ classic (4px-arm) model, base layer. Origin top-left.

export const ATLAS = 64;

// Each part: the six faces as [x, y, w, h] in the 64×64 atlas.
export const FACES = {
  head: {
    top:    [8, 0, 8, 8],  bottom: [16, 0, 8, 8],
    right:  [0, 8, 8, 8],  front:  [8, 8, 8, 8],
    left:   [16, 8, 8, 8], back:   [24, 8, 8, 8],
  },
  body: {
    top:    [20, 16, 8, 4], bottom: [28, 16, 8, 4],
    right:  [16, 20, 4, 12], front: [20, 20, 8, 12],
    left:   [28, 20, 4, 12], back:  [32, 20, 8, 12],
  },
  rightArm: {
    top:    [44, 16, 4, 4], bottom: [48, 16, 4, 4],
    right:  [40, 20, 4, 12], front: [44, 20, 4, 12],
    left:   [48, 20, 4, 12], back:  [52, 20, 4, 12],
  },
  leftArm: {
    top:    [36, 48, 4, 4], bottom: [40, 48, 4, 4],
    right:  [32, 52, 4, 12], front: [36, 52, 4, 12],
    left:   [40, 52, 4, 12], back:  [44, 52, 4, 12],
  },
  rightLeg: {
    top:    [4, 16, 4, 4], bottom: [8, 16, 4, 4],
    right:  [0, 20, 4, 12], front: [4, 20, 4, 12],
    left:   [8, 20, 4, 12], back:  [12, 20, 4, 12],
  },
  leftLeg: {
    top:    [20, 48, 4, 4], bottom: [24, 48, 4, 4],
    right:  [16, 52, 4, 12], front: [20, 52, 4, 12],
    left:   [24, 52, 4, 12], back:  [28, 52, 4, 12],
  },
};

// ---------- low-level RGBA helpers ----------

const idx = (x, y, w) => (y * w + x) * 4;

/** Fill an atlas face rect with a solid RGBA color. */
export function fillFace(atlas, [fx, fy, fw, fh], [r, g, b, a = 255]) {
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const o = idx(fx + x, fy + y, ATLAS);
      atlas[o] = r; atlas[o + 1] = g; atlas[o + 2] = b; atlas[o + 3] = a;
    }
  }
}

/**
 * Area-average a source sub-rect [sx0,sy0,sx1,sy1) down into `fw×fh` cells and
 * write them to the atlas face. Fully-transparent source pixels are ignored; a
 * cell that sees no opaque source becomes transparent.
 * @returns {[number,number,number]|null} the average opaque color of the region.
 */
export function blitRegionToFace(atlas, src, sw, sh, region, face, opts = {}) {
  const [sx0, sy0, sx1, sy1] = region;
  const [fx, fy, fw, fh] = face;
  const mirror = !!opts.mirror;
  const rw = Math.max(1, sx1 - sx0);
  const rh = Math.max(1, sy1 - sy0);
  let accR = 0, accG = 0, accB = 0, accN = 0;

  for (let cy = 0; cy < fh; cy++) {
    for (let cx = 0; cx < fw; cx++) {
      const rx0 = Math.floor((cx / fw) * rw);
      const rx1 = Math.max(rx0 + 1, Math.floor(((cx + 1) / fw) * rw));
      const ry0 = Math.floor((cy / fh) * rh);
      const ry1 = Math.max(ry0 + 1, Math.floor(((cy + 1) / fh) * rh));
      const gx0 = sx0 + rx0, gx1 = sx0 + rx1, gy0 = sy0 + ry0, gy1 = sy0 + ry1;
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = gy0; yy < gy1; yy++) {
        for (let xx = gx0; xx < gx1; xx++) {
          if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
          const o = idx(xx, yy, sw);
          if (src[o + 3] < 128) continue; // skip background / transparent
          r += src[o]; g += src[o + 1]; b += src[o + 2]; n++;
        }
      }
      const dx = mirror ? fw - 1 - cx : cx;
      const o = idx(fx + dx, fy + cy, ATLAS);
      if (n === 0) {
        atlas[o + 3] = 0;
      } else {
        atlas[o] = Math.round(r / n);
        atlas[o + 1] = Math.round(g / n);
        atlas[o + 2] = Math.round(b / n);
        atlas[o + 3] = 255;
        accR += r / n; accG += g / n; accB += b / n; accN++;
      }
    }
  }
  return accN ? [Math.round(accR / accN), Math.round(accG / accN), Math.round(accB / accN)] : null;
}

/** Average opaque color over a source sub-rect, or null. */
export function regionAverage(src, sw, sh, [sx0, sy0, sx1, sy1]) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, sy0); y < Math.min(sh, sy1); y++) {
    for (let x = Math.max(0, sx0); x < Math.min(sw, sx1); x++) {
      const o = idx(x, y, sw);
      if (src[o + 3] < 128) continue;
      r += src[o]; g += src[o + 1]; b += src[o + 2]; n++;
    }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
}

/** Per-row opaque horizontal extent [minX, maxX] within a y-band, or null. */
export function bandExtent(src, sw, sh, y0, y1) {
  let min = sw, max = -1;
  for (let y = Math.max(0, y0); y < Math.min(sh, y1); y++) {
    for (let x = 0; x < sw; x++) {
      if (src[idx(x, y, sw) + 3] >= 128) { if (x < min) min = x; if (x > max) max = x; }
    }
  }
  return max < 0 ? null : [min, max + 1];
}
