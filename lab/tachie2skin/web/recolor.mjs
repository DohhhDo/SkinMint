// Luminance-preserving recolor: take a DETAILED base skin (real shading, folds,
// uniform structure) and repaint each region's HUE to the 立绘's colors while
// keeping the base pixel's LIGHTNESS — so all the crafted detail survives, only
// the colors change. The base provides detail; the 立绘 provides palette.

import { ATLAS, FACES } from "./mcatlas.mjs";

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hue2(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [Math.round(hue2(p, q, h + 1 / 3) * 255), Math.round(hue2(p, q, h) * 255), Math.round(hue2(p, q, h - 1 / 3) * 255)];
}

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
// skin: warm, light, low-ish green-blue spread. The g-b<45 guard excludes
// blonde/yellow HAIR (which has a large green-blue gap) from being read as skin.
const isSkin = (r, g, b) => r > 150 && r >= g && g >= b && r - b > 12 && r - b < 95 && g - b < 45;

// which body part owns each atlas pixel (for region-aware recolor)
function buildPartMap() {
  const map = new Int8Array(ATLAS * ATLAS).fill(-1);
  const parts = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"];
  parts.forEach((p, pi) => {
    for (const f of Object.values(FACES[p])) {
      const [fx, fy, fw, fh] = f;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) map[(fy + y) * ATLAS + (fx + x)] = pi;
    }
  });
  return map;
}
const PART = buildPartMap(); // 0 head,1 body,2 rArm,3 lArm,4 rLeg,5 leg

/**
 * @param {Uint8ClampedArray} base  64×64 RGBA of a detailed base skin
 * @param {{hair,skin,top,bottom,accent,eye,shirt?,shoe?:number[]}} colors
 * @returns {Uint8ClampedArray} recolored 64×64 RGBA
 */
export function recolorSkin(base, colors) {
  const out = new Uint8ClampedArray(base);
  const C = {
    hair: colors.hair ?? [40, 35, 38], skin: colors.skin ?? [240, 218, 196],
    top: colors.top ?? [40, 45, 70], bottom: colors.bottom ?? [40, 45, 70],
    accent: colors.accent ?? [200, 50, 50], eye: colors.eye ?? colors.accent ?? [180, 40, 40],
    shirt: colors.shirt ?? [232, 232, 236], shoe: colors.shoe ?? [30, 30, 36],
  };
  const hsl = {};
  for (const k in C) hsl[k] = rgbToHsl(...C[k]);

  // role per pixel
  function roleOf(part, r, g, b) {
    const L = lum(r, g, b), S = sat(r, g, b);
    if (part === 0) {
      if (isSkin(r, g, b)) return "skin";
      if (S > 0.55 && L > 0.22 && L < 0.7) return "eye";
      return "hair";
    }
    if (part === 1) {
      if (isSkin(r, g, b)) return "skin";
      if (S > 0.42 && L > 0.2) return "accent";
      if (L > 0.72 && S < 0.25) return "shirt";
      return "top";
    }
    if (part === 2 || part === 3) {
      if (isSkin(r, g, b)) return "skin";
      if (L > 0.72 && S < 0.25) return "shirt";
      return "top";
    }
    if (isSkin(r, g, b)) return "skin";
    if (L < 0.28) return "shoe";
    return "bottom";
  }

  // pass 1: per-role mean lightness, so we can re-center on the target's lightness
  // (keeps the base's local shading/detail but makes a dark target actually dark).
  const roles = new Array(ATLAS * ATLAS);
  const sumL = {}, cntL = {};
  for (let i = 0; i < ATLAS * ATLAS; i++) {
    const o = i * 4;
    const part = PART[i];
    if (out[o + 3] < 128 || part < 0) { roles[i] = null; continue; }
    const role = roleOf(part, base[o], base[o + 1], base[o + 2]);
    roles[i] = role;
    sumL[role] = (sumL[role] ?? 0) + lum(base[o], base[o + 1], base[o + 2]);
    cntL[role] = (cntL[role] ?? 0) + 1;
  }
  const meanL = {};
  for (const k in sumL) meanL[k] = sumL[k] / cntL[k];

  // pass 2: recolor. newL = targetL + (pixelL - roleMeanL) * detail
  const DETAIL = 0.8;
  for (let i = 0; i < ATLAS * ATLAS; i++) {
    const role = roles[i];
    if (!role) continue;
    const o = i * 4;
    const L = lum(base[o], base[o + 1], base[o + 2]);
    const [h, s, tl] = hsl[role];
    let nl = tl + (L - meanL[role]) * DETAIL;
    nl = nl < 0.04 ? 0.04 : nl > 0.96 ? 0.96 : nl;
    const [nr, ng, nb] = hslToRgb(h, role === "shirt" ? s * 0.5 : s, nl);
    out[o] = nr; out[o + 1] = ng; out[o + 2] = nb;
  }

  if (colors.symmetrize !== false) {
    symmetrizePart(out, FACES.rightArm, FACES.leftArm);
    symmetrizePart(out, FACES.rightLeg, FACES.leftLeg);
  }
  return out;
}

/** Base skins from the model often have a one-sided artifact (stray pink arm).
 *  Copy the "cleaner" (darker = real sleeve/leg, not a bright artifact) side
 *  onto the other so arms/legs match. */
function symmetrizePart(atlas, partA, partB) {
  const meanL = (face) => {
    const [fx, fy, fw, fh] = face; let s = 0, n = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const o = ((fy + y) * ATLAS + fx + x) * 4;
      if (atlas[o + 3] < 128) continue;
      s += lum(atlas[o], atlas[o + 1], atlas[o + 2]); n++;
    }
    return n ? s / n : 1;
  };
  // brighter side is the artifact; copy darker side over it
  const [src, dst] = meanL(partA.front) <= meanL(partB.front) ? [partA, partB] : [partB, partA];
  for (const name of Object.keys(src)) {
    const [sx, sy, sw, sh] = src[name], [dx, dy] = dst[name];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const so = ((sy + y) * ATLAS + sx + x) * 4, doo = ((dy + y) * ATLAS + dx + x) * 4;
      atlas[doo] = atlas[so]; atlas[doo + 1] = atlas[so + 1]; atlas[doo + 2] = atlas[so + 2]; atlas[doo + 3] = atlas[so + 3];
    }
  }
}
