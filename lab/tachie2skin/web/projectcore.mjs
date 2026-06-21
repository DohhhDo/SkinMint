// Deterministic 立绘 → 64×64 atlas projection core. Pure functions over RGBA
// buffers; runs in browser and Node alike. The whole point of mode B: the front
// faces are the character's REAL pixels placed into the right UV faces, so dress
// color, hair, gender read correctly — no generative reinterpretation.

import {
  ATLAS, FACES, fillFace, blitRegionToFace, regionAverage, bandExtent,
} from "./mcatlas.mjs";

const idx = (x, y, w) => (y * w + x) * 4;
const dist2 = (a, b, c, d, e, f) => (a - d) ** 2 + (b - e) ** 2 + (c - f) ** 2;

/**
 * Flood-fill background removal from the four corners with TWO gates, so it
 * removes smooth gradient backdrops without eating the character:
 *   - step gate: a pixel must be close to the NEIGHBOUR it came from (follows a
 *     gradient, stops at the character's hard silhouette edge).
 *   - absolute gate: a pixel must stay within `tol` of its corner SEED color
 *     (the backdrop's color family), so smooth shading INSIDE the character
 *     can't carry the fill across the silhouette into skin/clothes.
 * `tol` is the absolute backdrop tolerance (the UI "背景容差"). Mutates alpha→0.
 */
export function removeBackground(src, sw, sh, tol = 110) {
  const tAbs2 = tol * tol * 3;
  const STEP = 30, tStep2 = STEP * STEP * 3;
  const visited = new Uint8Array(sw * sh);
  // stack entries: p, fromR, fromG, fromB, seedR, seedG, seedB
  const stack = [];
  const push = (p, fr, fg, fb, sr, sg, sb) => stack.push(p, fr, fg, fb, sr, sg, sb);
  for (const [sxc, syc] of [[0, 0], [sw - 1, 0], [0, sh - 1], [sw - 1, sh - 1]]) {
    const so = idx(sxc, syc, sw);
    if (src[so + 3] < 128) continue;
    const r = src[so], g = src[so + 1], b = src[so + 2];
    push(syc * sw + sxc, r, g, b, r, g, b);
  }
  while (stack.length) {
    const sb = stack.pop(), sg = stack.pop(), sr = stack.pop();
    const fb = stack.pop(), fg = stack.pop(), fr = stack.pop();
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    const o = p * 4;
    if (src[o + 3] < 128) continue;
    const r = src[o], g = src[o + 1], b = src[o + 2];
    if (dist2(r, g, b, fr, fg, fb) > tStep2) continue; // hard edge
    if (dist2(r, g, b, sr, sg, sb) > tAbs2) continue;   // left the backdrop family
    src[o + 3] = 0;
    const x = p % sw, y = (p - x) / sw;
    if (x > 0) push(p - 1, r, g, b, sr, sg, sb);
    if (x < sw - 1) push(p + 1, r, g, b, sr, sg, sb);
    if (y > 0) push(p - sw, r, g, b, sr, sg, sb);
    if (y < sh - 1) push(p + sw, r, g, b, sr, sg, sb);
  }
  return src;
}

/**
 * Median-cut palette from the opaque source pixels. Snapping the muddy
 * area-averaged atlas to this small set of REAL character colors restores the
 * flat, saturated cel-shaded look of a real Minecraft skin.
 */
export function buildPalette(src, sw, sh, k = 16) {
  const px = [];
  const step = Math.max(1, Math.floor((sw * sh) / 40000)); // subsample for speed
  for (let i = 0; i < sw * sh; i += step) {
    const o = i * 4;
    if (src[o + 3] >= 128) px.push([src[o], src[o + 1], src[o + 2]]);
  }
  if (!px.length) return [[200, 200, 200]];
  let boxes = [px];
  while (boxes.length < k) {
    // split the box with the largest channel range
    let bi = -1, bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      let rng = 0;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of boxes[i]) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        rng = Math.max(rng, hi - lo);
      }
      if (rng > bestRange) { bestRange = rng; bi = i; }
    }
    if (bi < 0) break;
    const box = boxes[bi];
    let ch = 0, best = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0;
      for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
      if (hi - lo > best) { best = hi - lo; ch = c; }
    }
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
    return [Math.round(r / box.length), Math.round(g / box.length), Math.round(b / box.length)];
  });
}

/** Snap every opaque atlas pixel to its nearest palette color. */
export function quantizeToPalette(atlas, palette) {
  for (let i = 0; i < atlas.length; i += 4) {
    if (atlas[i + 3] < 128) continue;
    const r = atlas[i], g = atlas[i + 1], b = atlas[i + 2];
    let best = 0, bd = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const d = dist2(r, g, b, palette[j][0], palette[j][1], palette[j][2]);
      if (d < bd) { bd = d; best = j; }
    }
    atlas[i] = palette[best][0]; atlas[i + 1] = palette[best][1]; atlas[i + 2] = palette[best][2];
  }
  return atlas;
}

/** Vertical opaque extent → [topY, bottomY) over the whole image, or null. */
function verticalExtent(src, sw, sh) {
  let top = -1, bot = -1;
  for (let y = 0; y < sh; y++) {
    let any = false;
    for (let x = 0; x < sw; x++) if (src[idx(x, y, sw) + 3] >= 128) { any = true; break; }
    if (any) { if (top < 0) top = y; bot = y; }
  }
  return bot < 0 ? null : [top, bot + 1];
}

// ---- color extraction for the retrieve+recolor pipeline ----

/** Most common color in a region (coarse 12-bit histogram), optional predicate. */
function dominantColor(src, sw, sh, [x0, y0, x1, y1], pred) {
  const sum = new Map(); // bin -> [r,g,b,count]
  for (let y = Math.max(0, y0 | 0); y < Math.min(sh, y1 | 0); y++) {
    for (let x = Math.max(0, x0 | 0); x < Math.min(sw, x1 | 0); x++) {
      const o = (y * sw + x) * 4;
      if (src[o + 3] < 128) continue;
      const r = src[o], g = src[o + 1], b = src[o + 2];
      if (pred && !pred(r, g, b)) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = sum.get(key);
      if (e) { e[0] += r; e[1] += g; e[2] += b; e[3]++; } else sum.set(key, [r, g, b, 1]);
    }
  }
  let best = null, bn = 0;
  for (const e of sum.values()) if (e[3] > bn) { bn = e[3]; best = e; }
  return best ? [Math.round(best[0] / best[3]), Math.round(best[1] / best[3]), Math.round(best[2] / best[3])] : null;
}

const isSkin = (r, g, b) => r > 140 && r >= g && g >= b && r - b > 12 && r - b < 120;
const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

/** The most saturated sizeable color (ribbon / eyes / accent). */
function accentColor(src, sw, sh) {
  const sum = new Map();
  const step = Math.max(1, Math.floor((sw * sh) / 60000));
  for (let i = 0; i < sw * sh; i += step) {
    const o = i * 4;
    if (src[o + 3] < 128) continue;
    const r = src[o], g = src[o + 1], b = src[o + 2];
    if (sat(r, g, b) < 0.35 || Math.max(r, g, b) < 70) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = sum.get(key);
    if (e) { e[0] += r; e[1] += g; e[2] += b; e[3]++; } else sum.set(key, [r, g, b, 1]);
  }
  let best = null, bs = 0;
  for (const e of sum.values()) {
    const r = e[0] / e[3], g = e[1] / e[3], b = e[2] / e[3];
    const score = sat(r, g, b) * Math.sqrt(e[3]);
    if (score > bs) { bs = score; best = [Math.round(r), Math.round(g), Math.round(b)]; }
  }
  return best;
}

/**
 * Extract a character palette from a (segmented) 立绘 for buildBaseSkin.
 * @returns {{hair,skin,top,bottom,accent,eye,shoe:number[]}}
 */
export function extractColors(src, sw, sh, guides = {}, opts = {}) {
  const g = { ...DEFAULT_GUIDES, ...guides };
  if (opts.removeBg) removeBackground(src, sw, sh, opts.bgTol ?? 110);
  const [by0, by1] = verticalExtent(src, sw, sh) ?? [0, sh];
  const Hh = Math.max(1, by1 - by0);
  const neckY = Math.round(by0 + g.neck * Hh);
  const hipY = Math.round(by0 + g.hip * Hh);
  const fringeY = Math.round(by0 + g.hairFace * (neckY - by0));

  const hx = bandExtent(src, sw, sh, by0, neckY) ?? [0, sw];
  const hair = dominantColor(src, sw, sh, [hx[0], by0, hx[1], fringeY]) ?? [50, 42, 40];
  const skin = dominantColor(src, sw, sh, [hx[0], fringeY, hx[1], neckY], isSkin)
    ?? dominantColor(src, sw, sh, [hx[0], fringeY, hx[1], neckY]) ?? [240, 214, 190];
  const top = dominantColor(src, sw, sh, [0, neckY, sw, hipY]) ?? [70, 80, 120];
  const bottom = dominantColor(src, sw, sh, [0, hipY, sw, by1]) ?? [50, 55, 80];
  const accent = accentColor(src, sw, sh) ?? [200, 60, 60];
  return { hair, skin, top, bottom, accent, eye: accent, shoe: bottom.map((v) => Math.round(v * 0.55)) };
}

const DEFAULT_GUIDES = {
  neck: 0.16,        // head / torso split (fraction of character height)
  hip: 0.50,         // torso / legs split
  hairFace: 0.42,    // within head: top fraction is hair fringe, rest is face
  faceWidth: 0.5,    // central fraction of the head width that is the FACE (rest = side hair)
  torsoCenter: 0.50, // central fraction of the torso band that is body (rest = arms)
};

const SKIN = [232, 185, 140];

/**
 * @param {Uint8ClampedArray} src  RGBA, length sw*sh*4 (background already alpha-0,
 *                                 or pass opts.removeBg to strip it here)
 * @param {object} guides  fractions, see DEFAULT_GUIDES (overrides merged in)
 * @param {{ removeBg?: boolean, bgTol?: number }} [opts]
 * @returns {Uint8ClampedArray} 64*64*4 atlas
 */
export function projectToAtlas(src, sw, sh, guides = {}, opts = {}) {
  const g = { ...DEFAULT_GUIDES, ...guides };
  if (opts.removeBg) removeBackground(src, sw, sh, opts.bgTol ?? 36);

  const atlas = new Uint8ClampedArray(ATLAS * ATLAS * 4); // all transparent

  const vext = verticalExtent(src, sw, sh) ?? [0, sh];
  const [by0, by1] = vext;
  const Hh = Math.max(1, by1 - by0);
  const neckY = Math.round(by0 + g.neck * Hh);
  const hipY = Math.round(by0 + g.hip * Hh);

  const solid = (face, color, fallback) => fillFace(atlas, face, color ? [...color, 255] : [...fallback, 255]);

  // ---------- HEAD ----------
  {
    const hx = bandExtent(src, sw, sh, by0, neckY);
    if (hx) {
      const faceTopY = Math.round(by0 + g.hairFace * (neckY - by0));
      const hair = regionAverage(src, sw, sh, [hx[0], by0, hx[1], faceTopY]) ?? SKIN;
      // front = ONLY the central face column (skin + eyes), so long side-hair
      // doesn't swallow the face and turn the head into a dark blob.
      const hw = hx[1] - hx[0];
      const fw = Math.max(2, Math.round(hw * g.faceWidth));
      const cx = Math.round((hx[0] + hx[1]) / 2);
      blitRegionToFace(atlas, src, sw, sh, [cx - (fw >> 1), faceTopY, cx + Math.ceil(fw / 2), neckY], FACES.head.front);
      const neckCol = regionAverage(src, sw, sh, [cx - (fw >> 1), neckY - 2, cx + Math.ceil(fw / 2), neckY]) ?? SKIN;
      solid(FACES.head.top, hair); solid(FACES.head.back, hair);
      solid(FACES.head.left, hair); solid(FACES.head.right, hair);
      solid(FACES.head.bottom, neckCol);
    } else {
      for (const f of Object.values(FACES.head)) solid(f, SKIN);
    }
  }

  // ---------- TORSO + ARMS ----------
  {
    const tx = bandExtent(src, sw, sh, neckY, hipY);
    if (tx) {
      const [tMin, tMax] = tx;
      const w = tMax - tMin;
      const armW = Math.max(1, Math.round((w * (1 - g.torsoCenter)) / 2));
      const bodyReg = [tMin + armW, neckY, tMax - armW, hipY];
      const rArmReg = [tMin, neckY, tMin + armW, hipY];        // character right = viewer left
      const lArmReg = [tMax - armW, neckY, tMax, hipY];

      const bodyCol = blitRegionToFace(atlas, src, sw, sh, bodyReg, FACES.body.front) ?? SKIN;
      blitRegionToFace(atlas, src, sw, sh, bodyReg, FACES.body.back, { mirror: true });
      solid(FACES.body.left, bodyCol); solid(FACES.body.right, bodyCol);
      solid(FACES.body.top, bodyCol); solid(FACES.body.bottom, bodyCol);

      const rCol = blitRegionToFace(atlas, src, sw, sh, rArmReg, FACES.rightArm.front) ?? bodyCol;
      blitRegionToFace(atlas, src, sw, sh, rArmReg, FACES.rightArm.back, { mirror: true });
      for (const f of ["left", "right", "top", "bottom"]) solid(FACES.rightArm[f], rCol);

      const lCol = blitRegionToFace(atlas, src, sw, sh, lArmReg, FACES.leftArm.front) ?? bodyCol;
      blitRegionToFace(atlas, src, sw, sh, lArmReg, FACES.leftArm.back, { mirror: true });
      for (const f of ["left", "right", "top", "bottom"]) solid(FACES.leftArm[f], lCol);
    } else {
      for (const part of [FACES.body, FACES.rightArm, FACES.leftArm])
        for (const f of Object.values(part)) solid(f, SKIN);
    }
  }

  // ---------- LEGS ----------
  {
    const lx = bandExtent(src, sw, sh, hipY, by1);
    if (lx) {
      const [lMin, lMax] = lx;
      const midX = Math.round((lMin + lMax) / 2);
      const rLegReg = [lMin, hipY, midX, by1];   // character right = viewer left
      const lLegReg = [midX, hipY, lMax, by1];

      const rCol = blitRegionToFace(atlas, src, sw, sh, rLegReg, FACES.rightLeg.front) ?? SKIN;
      blitRegionToFace(atlas, src, sw, sh, rLegReg, FACES.rightLeg.back, { mirror: true });
      const rShoe = regionAverage(src, sw, sh, [lMin, by1 - Math.round(Hh * 0.06), midX, by1]) ?? rCol;
      for (const f of ["left", "right", "top"]) solid(FACES.rightLeg[f], rCol);
      solid(FACES.rightLeg.bottom, rShoe);

      const lCol = blitRegionToFace(atlas, src, sw, sh, lLegReg, FACES.leftLeg.front) ?? SKIN;
      blitRegionToFace(atlas, src, sw, sh, lLegReg, FACES.leftLeg.back, { mirror: true });
      const lShoe = regionAverage(src, sw, sh, [midX, by1 - Math.round(Hh * 0.06), lMax, by1]) ?? lCol;
      for (const f of ["left", "right", "top"]) solid(FACES.leftLeg[f], lCol);
      solid(FACES.leftLeg.bottom, lShoe);
    } else {
      for (const part of [FACES.rightLeg, FACES.leftLeg])
        for (const f of Object.values(part)) solid(f, SKIN);
    }
  }

  // Snap to a flat, saturated character palette for the real MC cel-shaded look.
  if (opts.quantize !== false) {
    quantizeToPalette(atlas, buildPalette(src, sw, sh, opts.colors ?? 16));
  }
  return atlas;
}
