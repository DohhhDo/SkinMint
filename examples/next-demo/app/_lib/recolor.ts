import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { SKIN_TAGS, type Gender, type Lower } from "./skinTags";

type RGB = [number, number, number];
export interface TargetPalette { skin?: string; hair?: string; top?: string; bottom?: string; eyes?: string; accent?: string; shoes?: string; headwear?: string }
export interface Structure { gender?: Gender; lower?: Lower }

const isSkin = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 150 && mx <= 255 && mx - mn >= 12 && mx - mn <= 100; };
const hx2 = (h: string): RGB => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const dist = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Dominant region colors of a 64×64 skin, plus how much bare skin the torso shows. */
function featOf(png: PNG): { skin: RGB; hair: RGB; top: RGB; armTop: RGB; bottom: RGB; skinRatio: number; bangsRatio: number } {
  const d = png.data, W = png.width;
  const at = (x: number, y: number) => [d[(y * W + x) * 4], d[(y * W + x) * 4 + 1], d[(y * W + x) * 4 + 2], d[(y * W + x) * 4 + 3]] as number[];
  const dom = (x0: number, y0: number, w: number, h: number, so: boolean, ns: boolean): RGB | null => {
    const m = new Map<number, number[]>();
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const [r, g, b, a] = at(x, y); if (a! < 40) continue; if (so && !isSkin(r!, g!, b!)) continue; if (ns && isSkin(r!, g!, b!)) continue; const k = ((r! >> 4) << 8) | ((g! >> 4) << 4) | (b! >> 4); const e = m.get(k) || [0, 0, 0, 0]; e[0]! += r!; e[1]! += g!; e[2]! += b!; e[3]!++; m.set(k, e); }
    let bs: number[] | null = null; for (const e of m.values()) if (!bs || e[3]! > bs[3]!) bs = e;
    return bs ? [bs[0]! / bs[3]!, bs[1]! / bs[3]!, bs[2]! / bs[3]!] : null;
  };
  // bare-skin fraction of torso + arm fronts — distinguishes a covered jacket
  // (long sleeves) from bare arms / a bare midriff.
  let sk = 0, tot = 0;
  for (const [rx, ry, rw, rh] of [[20, 20, 8, 12], [44, 20, 4, 12], [36, 52, 4, 12]] as const)
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { const [r, g, b, a] = at(x, y); if (a! < 40) continue; tot++; if (isSkin(r!, g!, b!)) sk++; }
  // bangs: non-skin fraction across the forehead (top of the front face). Anime
  // characters almost always have a fringe; a bare forehead base looks bald after recolor.
  let bh = 0, bt = 0;
  for (let y = 8; y < 10; y++) for (let x = 8; x < 16; x++) { const [r, g, b, a] = at(x, y); if (a! < 40) continue; bt++; if (!isSkin(r!, g!, b!)) bh++; }
  return {
    skin: dom(8, 8, 8, 8, true, false) || dom(44, 20, 4, 12, true, false) || [240, 210, 190],
    hair: dom(8, 0, 8, 8, false, true) || [60, 45, 40], top: dom(20, 20, 8, 12, false, true) || [120, 120, 130],
    // arm sleeve color, sampled separately — a base's sleeves can differ from its torso (e.g. a
    // jacket over a shirt). Recoloring the arms from the torso's color is what turned a red sleeve
    // bright blue. Falls back to the torso color when arms read the same.
    armTop: dom(44, 20, 4, 12, false, true) || dom(20, 20, 8, 12, false, true) || [120, 120, 130],
    bottom: dom(4, 20, 4, 12, false, true) || [60, 60, 70], skinRatio: tot ? sk / tot : 0, bangsRatio: bt ? bh / bt : 0,
  };
}

type Base = { id: string; buf: Buffer; f: ReturnType<typeof featOf>; gender?: Gender; lower?: Lower };
let _lib: Base[] | null = null;
function library(): Base[] {
  if (_lib) return _lib;
  const dir = join(process.cwd(), "public", "skinmint", "skins");
  _lib = readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => {
    const id = f.replace(".png", ""), buf = readFileSync(join(dir, f)), tag = SKIN_TAGS[id];
    return { id, buf, f: featOf(PNG.sync.read(buf)), gender: tag?.[0], lower: tag?.[1] };
  });
  return _lib;
}

// Keep a structure filter only if it leaves enough candidates — a tiny bucket
// would force a bad color match, and recolor can't fix a wildly-off palette.
const MIN_POOL = 4;
function narrow(pool: Base[], pred: (b: Base) => boolean): Base[] {
  const f = pool.filter(pred);
  return f.length >= MIN_POOL ? f : pool;
}

/** Nearest curated base to a target palette, filtered to the matching silhouette first
 *  (gender, then lower-body), then color-ranked within that pool (hair/top weighted heaviest). */
function nearest(t: { skin: RGB; hair: RGB; top: RGB; bottom: RGB }, s: Structure = {}) {
  // Hard-filter on gender only — a male base for a female char (or vice versa) is the one
  // mismatch recolor can't rescue. Everything else (coverage, bangs, skirt-vs-pants) is a
  // soft penalty: recolor repaints the palette, so the base's COLORS barely matter; what
  // matters is its SHAPE — covered vs bare, fringe vs bald, and (least) the leg garment.
  let pool = library();
  if (s.gender) pool = narrow(pool, (b) => b.gender === s.gender);
  const covered = dist(t.top, t.skin) > 4000;
  let best = pool[0]!, bd = Infinity;
  for (const e of pool) {
    const coverage = (covered ? e.f.skinRatio : 1 - e.f.skinRatio) * 200000; // bare skin where the outfit should cover
    const bangs = (1 - e.f.bangsRatio) * 150000;                              // bald forehead after recolor
    const lower = s.lower && e.lower && e.lower !== s.lower ? 60000 : 0;      // skirt vs pants — mild nudge
    const colorTie = (dist(t.skin, e.f.skin) + 1.6 * dist(t.hair, e.f.hair) + 1.6 * dist(t.top, e.f.top) + 0.7 * dist(t.bottom, e.f.bottom)) * 0.1;
    const d = coverage + bangs + lower + colorTie;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const rgb2hsv = (r: number, g: number, b: number): RGB => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn; let h = 0; if (dd) { if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? dd / mx : 0, mx]; };
const hsv2rgb = (h: number, s: number, v: number): RGB => { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
const cl = (x: number) => Math.max(0, Math.min(1, x));

// Face UV rects (front + head overlay) where eyes are painted on a MC skin.
const FACES = [[8, 8], [40, 8]] as const;
// Front-torso fallback rect — where a synthetic collar/tie reads as a ribbon when the
// base has no detectable accent of its own.
const TORSO_X = 20, TORSO_Y = 20;
// Upper-torso UV bands (base layer + jacket overlay) scanned for the base's own chest
// decoration — a tie / ribbon / bow / sailor collar — so the accent lands where the
// base actually draws one instead of always at the collar. [x0, x1, y0, y1).
const ACCENT_BANDS = [[22, 26, 20, 24], [22, 26, 37, 41]] as const;
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };

// 6-face UV rects for a cuboid part at (ox,oy) — same convention as @skinmint/skin's canvas.
const faceRects = (ox: number, oy: number, w: number, h: number, d: number) => ({ py: [ox + d, oy, w, d], ny: [ox + d + w, oy, w, d], nx: [ox, oy + d, d, h], pz: [ox + d, oy + d, w, h], px: [ox + d + w, oy + d, d, h], nz: [ox + d + w + d, oy + d, w, h] } as Record<string, [number, number, number, number]>);
// Shoe = bottom SHOE_ROWS rows of each leg's vertical faces, plus the foot sole (ny).
const LEG_BOXES = [[0, 16, 4, 12, 4], [0, 32, 4, 12, 4], [16, 48, 4, 12, 4], [0, 48, 4, 12, 4]] as const;
const SHOE_ROWS = 3;
function shoeRects(): [number, number, number, number][] {
  const r: [number, number, number, number][] = [];
  for (const [ox, oy, w, h, d] of LEG_BOXES) { const f = faceRects(ox, oy, w, h, d); for (const k of ["nx", "pz", "px", "nz"]) { const [x, y, ww, hh] = f[k]!; r.push([x, y + hh - SHOE_ROWS, ww, SHOE_ROWS]); } r.push(f.ny!); }
  return r;
}
export type Headwear = "none" | "hat" | "hood" | "ears" | "horns";
/** Draw an element the base lacks (ears/horns/hat) on the head-overlay layer (box 32,0,8,8,8).
 *  py=[40,0,8,8] top, pz=[40,8,8,8] forehead, sides at x32/48/56. */
function paintHeadwear(d: Buffer, W: number, type: Headwear, color: RGB | undefined, hairC: RGB) {
  const set = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x >= W || y >= 64) return; const o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
  const fillR = (x: number, y: number, w: number, h: number, c: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  if (type === "ears") { const c = hairC; // hair-colored animal ears: triangles on the head-top corners + carried onto the forehead edge so they read head-on
    for (const [x, y] of [[40, 0], [41, 0], [42, 0], [40, 1], [41, 1], [40, 2], [47, 0], [46, 0], [45, 0], [47, 1], [46, 1], [47, 2]] as const) set(x, y, c);
    set(40, 8, c); set(41, 8, c); set(46, 8, c); set(47, 8, c);
  } else if (type === "horns") { const c = color ?? [70, 52, 40];
    for (const bx of [40, 46]) { set(bx, 0, c); set(bx, 1, c); set(bx, 2, c); } set(40, 8, c); set(46, 8, c);
  } else if (type === "hat" || type === "hood") { const c = color ?? hairC;
    fillR(40, 0, 8, 8, c); for (const x of [40, 32, 48, 56]) fillR(x, 8, 8, 3, c);
  }
}

/** Recolor a base skin to the target palette. Bulk regions remap by nearest-source-color
 *  (hue replace + additive S/V — keeps shading). Eyes & accent are the identity-critical
 *  small bits a VLM supplies: irises get the eye color, the collar gets the accent. */
function recolor(baseBuf: Buffer, src: ReturnType<typeof featOf>, tgt: Record<string, RGB>, headwear?: Headwear): Buffer {
  const png = PNG.sync.read(baseBuf), d = png.data, W = png.width;
  const orig = Buffer.from(d); // pre-recolor copy, for detecting irises by their original look
  const idx = (x: number, y: number) => (y * W + x) * 4;

  // ① bulk regions. Classify by UV layout first (head → hair/skin, body → top/bottom/skin),
  //    then by nearest source color within that group — robust to a base whose hair color
  //    happens to sit near its clothing, which a global nearest-color match gets wrong.
  const keys = (["skin", "hair", "top", "bottom"] as const).filter((k) => tgt[k]);
  const sH: Record<string, RGB> = {}, tH: Record<string, RGB> = {}, sRGB: Record<string, RGB> = {};
  for (const k of keys) { sRGB[k] = src[k]; sH[k] = rgb2hsv(...src[k]); tH[k] = rgb2hsv(...tgt[k]!); }
  const headKeys = keys.filter((k) => k === "skin" || k === "hair");
  const hasHair = keys.includes("hair");
  // Leg UV blocks on a 64×64 skin (base + overlay): right leg x0-15 y16-47; left leg
  // x0-31 y48-63. Everything else below the head (x≥16 y16-47, arms x40+) is torso/arms.
  const isLeg = (x: number, y: number) => (x < 16 && y < 48) || (x < 32 && y >= 48);
  // Arm UV: right arm x40-55 y16-47, left arm x32-63 y48-63. Arms recolor from src.armTop
  // (their own sleeve color) so a jacket sleeve that differs from the torso comes out right.
  const isArm = (x: number, y: number) => (x >= 40 && y >= 16 && y < 48) || (x >= 32 && y >= 48);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 40) continue;
    const px = (i / 4) % W, y = Math.floor(i / 4 / W);
    const p: RGB = [d[i]!, d[i + 1]!, d[i + 2]!];
    let bk: string;
    if (y < 16) {
      // Head: the only skin is the face rect (front + overlay). Everything else on the
      // head is hair by geometry — robust even when the base's hair is pale (anya/klee).
      const inFace = ((px >= 8 && px < 16) || (px >= 40 && px < 48)) && y >= 8;
      if (!inFace && hasHair) bk = "hair";
      else { bk = headKeys[0]!; let bd = Infinity; for (const k of headKeys) { const dd = dist(p, sRGB[k]!); if (dd < bd) { bd = dd; bk = k; } } }
    } else {
      // Body: a skin pixel (bare arm/leg/midriff) → skin; everything else is the garment for this
      // UV block — torso/arms→top, legs→bottom. Decide by isSkin, NOT nearest-source-color: a
      // WHITE garment is closer in RGB to pale skin than to a dark top, so color-matching turned
      // white shirts into skin-colored blobs. Geometry also avoids the same-color top/bottom scatter.
      const garment = isLeg(px, y) ? "bottom" : "top";
      bk = (keys.includes("skin") && isSkin(p[0], p[1], p[2])) ? "skin" : keys.includes(garment) ? garment : keys.includes("top") ? "top" : keys[0]!;
    }
    const s = (bk === "top" && isArm(px, y)) ? rgb2hsv(...src.armTop) : sH[bk]!, t = tH[bk]!;
    const [, ps, pv] = rgb2hsv(...p);
    // Target-anchored recolor. Plain additive S/V (ps+(t-s)) keeps the base's shading, but a
    // pixel that DEVIATES from the region's source color blows past the target: a white shirt
    // under a dark-sampled jacket → near-white; a saturated green hair-clip under a near-grey
    // hair target → green (because #333433's hue is a noisy 120°). So cap S and V within ~0.35
    // of the target, and when the target is near-grey (S<0.1) force low S so its noise hue can't
    // tint anything. Single-color regions (ps≈s) are unaffected — full shading preserved.
    const ns = t[1] < 0.1 ? t[1] : Math.min(cl(ps + (t[1] - s[1])), t[1] + 0.35);
    const nv = Math.min(cl(pv + (t[2] - s[2])), t[2] + 0.35);
    const [r, g, b] = hsv2rgb(t[0], ns, nv);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }

  // ② eyes — recolor the iris pixels. An iris pixel is non-skin, not an eye-white, not the
  //    dark outline, and not the base's hair color (bangs in the face). The eye ROW varies by
  //    base (a census across the library puts it anywhere y10..y14), so a fixed band either
  //    misses ~30% of bases (too narrow) or tints the mouth/bang-dip (too wide). Instead find
  //    the eye row dynamically: within fy+1..fy+6, the row with the most iris pixels — but only
  //    rows with 1..6 of them, since a row of 7..8 is a full fringe (bangs), not eyes. Then
  //    paint that row ±1. The iris-count cap is what makes this robust to heavy fringes (the
  //    earlier dynamic attempt failed for lacking it).
  if (tgt.eyes) {
    const eye = tgt.eyes;
    const isIris = (o: number) => {
      const r = orig[o]!, g = orig[o + 1]!, b = orig[o + 2]!, a = orig[o + 3]!;
      if (a < 40 || isSkin(r, g, b)) return false;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mn > 200 || mx < 55) return false;             // eye-white / dark outline
      if (mx > 180) return false;                        // too bright to be an iris — skip cheek blush / bright makeup / skin a base draws on the face
      return dist([r, g, b], src.hair) >= 1600;          // exclude bangs (hair color)
    };
    for (const [fx, fy] of FACES) {
      let peakY = -1, peakN = 0;
      for (let y = fy + 1; y <= fy + 6; y++) { let n = 0; for (let x = fx; x < fx + 8; x++) if (isIris(idx(x, y))) n++; if (n >= 1 && n <= 6 && n > peakN) { peakN = n; peakY = y; } }
      if (peakN === 0) {
        // The OVERLAY face (fx=40) with no detectable eyes = bangs/hat drawn over the face. If it's
        // opaque it half-occludes the base front's eyes (→ only one eye shows). Clear its eye band
        // to transparent so both base eyes show through. (Base face fx=8 just has no eyes — skip.)
        if (fx === 40) for (let y = fy + 3; y <= fy + 5; y++) for (let x = fx; x < fx + 8; x++) d[idx(x, y) + 3] = 0;
        continue;
      }
      for (let y = Math.max(fy, peakY - 1); y <= Math.min(fy + 7, peakY + 1); y++) for (let x = fx; x < fx + 8; x++) {
        const o = idx(x, y); if (!isIris(o)) continue;
        d[o] = eye[0]; d[o + 1] = eye[1]; d[o + 2] = eye[2];
      }
    }
  }

  // ③ accent — repaint the base's OWN chest decoration (tie/ribbon/bow/sailor collar) with
  //    the target accent color, so it lands where the base draws one. Detect it as upper-torso
  //    pixels whose hue departs from the shirt (or, for a grayscale shirt, that are markedly
  //    more saturated) — distinct from skin and outline. Fall back to a synthetic collar line
  //    only when the base has no such region (<3 px) or the region is too big to be an accent
  //    (>28 px → it's a garment color block, not a small standout).
  if (tgt.accent) {
    const a = tgt.accent;
    const topH = rgb2hsv(...src.top);
    const found: number[] = [];
    for (const [x0, x1, y0, y1] of ACCENT_BANDS) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const o = idx(x, y), r = orig[o]!, g = orig[o + 1]!, b = orig[o + 2]!;
      if (orig[o + 3]! < 40 || isSkin(r, g, b) || Math.max(r, g, b) < 55) continue;
      const h = rgb2hsv(r, g, b);
      if (h[1] > 0.2 && (topH[1] < 0.15 ? h[1] > 0.35 : hueDist(h[0], topH[0]) > 40)) found.push(o);
    }
    if (found.length >= 3 && found.length <= 8) {
      for (const o of found) { d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; }
    } else {
      // fallback: a small knot just below the collar center — reads as a ribbon/tie without
      // painting a wide collar band (which looked like a red stripe across the chest).
      const set = (x: number, y: number) => { const o = idx(x, y); if (d[o + 3]! >= 40) { d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; } };
      for (const [dx, dy] of [[2, 0], [3, 0], [2, 1], [3, 1], [2, 2], [3, 2]] as const) set(TORSO_X + dx, TORSO_Y + dy);
    }
  }

  // ④ shoes — recolor the foot rows of the legs to the shoe color (① painted them as bottom).
  //    Keep shading: hue-replace from the original shoe-area color, so boots read as boots.
  if (tgt.shoes) {
    const rects = shoeRects();
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (const [x, y, w, h] of rects) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = idx(x + i, y + j); if (orig[o + 3]! < 40) continue; const r = orig[o]!, g = orig[o + 1]!, b = orig[o + 2]!; if (isSkin(r, g, b)) continue; sr += r; sg += g; sb += b; sn++; }
    if (sn) {
      const ssv = rgb2hsv(sr / sn, sg / sn, sb / sn), tsv = rgb2hsv(...tgt.shoes);
      for (const [x, y, w, h] of rects) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = idx(x + i, y + j); if (orig[o + 3]! < 40) continue; const r = orig[o]!, g = orig[o + 1]!, b = orig[o + 2]!; if (isSkin(r, g, b)) continue; const [, ps, pv] = rgb2hsv(r, g, b); const [R, G, B] = hsv2rgb(tsv[0], cl(ps + (tsv[1] - ssv[1])), cl(pv + (tsv[2] - ssv[2]))); d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255; }
    }
  }

  // ⑤ headwear — actively draw an element the base lacks (animal ears / horns / hat) so the
  //    character's identity carries even when no curated base has it.
  if (headwear && headwear !== "none") paintHeadwear(d, W, headwear, tgt.headwear, tgt.hair ?? [60, 45, 40]);

  return PNG.sync.write(png);
}

/**
 * Generate a skin by retrieving the nearest clean curated base and recoloring it
 * to the input palette — clean + detailed (human-made structure) + color-faithful.
 */
export function generateSkinFromPalette(target: TargetPalette, structure: Structure = {}, opts: { forceBase?: string; headwear?: Headwear } = {}): { png: Uint8Array; baseId: string } {
  const t: Record<string, RGB> = {};
  for (const k of ["skin", "hair", "top", "bottom", "eyes", "accent", "shoes", "headwear"] as const) if (target[k]) t[k] = hx2(target[k]!);
  const full = { skin: t.skin ?? [240, 210, 190], hair: t.hair ?? [60, 45, 40], top: t.top ?? [120, 120, 130], bottom: t.bottom ?? [60, 60, 70] };
  const base = (opts.forceBase && library().find((b) => b.id === opts.forceBase)) || nearest(full, structure);
  return { png: new Uint8Array(recolor(base.buf, base.f, t, opts.headwear)), baseId: base.id };
}
