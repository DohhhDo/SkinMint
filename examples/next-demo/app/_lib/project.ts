import { PNG } from "pngjs";
import type { HeadSpec } from "@skinmint/skin";
import { paintEars, paintHorns, paintHat, paintHood, paintBand, paintBow, paintCrown, paintFaceAcc, type RGB, type Setter } from "./headStencils";

type RGBA = [number, number, number, number];

/**
 * Build a 64×64 Minecraft skin by FRONT-PROJECTING a standardized full-body, front-facing
 * character image onto the skin's front UV faces — real pixels, NO base library. Clothing/body
 * come straight from the image (so a black blazer is actually black); side/back/top faces are a
 * shaded copy of the front; the FACE is drawn (skin tone + irises), since an 8×8 projection of a
 * 立绘 face is always a blur. `eyeHex` (from the VLM) overrides the detected iris color.
 */
export function projectSkin(imageBuf: Buffer, opts: { eyeHex?: string; head?: HeadSpec; hairHex?: string } = {}): Uint8Array {
  const { eyeHex, head } = opts;
  const img = PNG.sync.read(imageBuf);
  const W = img.width, H = img.height, d = img.data;
  const at = (x: number, y: number): RGBA => { const i = (y * W + x) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]; };
  const bgLike = (r: number, g: number, b: number, a: number) => a < 40 || (Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 18);
  const isSkin = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 150 && mx <= 255 && mx - mn >= 12 && mx - mn <= 110; };

  // character bbox
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b, a] = at(x, y); if (!bgLike(r, g, b, a)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
  if (maxX < minX) return new Uint8Array(PNG.sync.write(new PNG({ width: 64, height: 64 })));
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  // skin fraction per row → detect face band, head bottom (neck), leg start (bare thighs)
  const skinFrac: number[] = [];
  for (let y = minY; y <= maxY; y++) { let s = 0, n = 0; for (let x = minX; x <= maxX; x++) { const [r, g, b, a] = at(x, y); if (bgLike(r, g, b, a)) continue; n++; if (isSkin(r, g, b)) s++; } skinFrac.push(n ? s / n : 0); }
  let faceTop = -1, faceBot = -1;
  for (let i = 0; i < bh * 0.32; i++) { if (skinFrac[i]! > 0.35) { if (faceTop < 0) faceTop = i; faceBot = i; } else if (faceTop >= 0 && i - faceBot > 3) break; }
  if (faceTop < 0) { faceTop = (bh * 0.05) | 0; faceBot = (bh * 0.14) | 0; }
  const headBot = Math.min(bh - 1, faceBot + (((faceBot - faceTop) * 0.5) | 0));
  let legStart = -1;
  for (let i = (bh * 0.45) | 0; i < bh; i++) { if (skinFrac[i]! > 0.30) { legStart = i; break; } }
  if (legStart < 0) legStart = (bh * 0.62) | 0;
  const FY = (abs: number) => minY + abs;

  // average non-bg color of a source rect → wxh grid
  const grid = (x0: number, y0: number, x1: number, y1: number, w: number, h: number): (RGBA | null)[][] => {
    const g: (RGBA | null)[][] = [];
    for (let j = 0; j < h; j++) { const row: (RGBA | null)[] = [];
      for (let i = 0; i < w; i++) {
        const cx0 = (x0 + (x1 - x0) * i / w) | 0, cx1 = (x0 + (x1 - x0) * (i + 1) / w) | 0, cy0 = (y0 + (y1 - y0) * j / h) | 0, cy1 = (y0 + (y1 - y0) * (j + 1) / h) | 0;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const [pr, pg, pb, pa] = at(x, y); if (bgLike(pr, pg, pb, pa)) continue; r += pr; gg += pg; b += pb; n++; }
        row.push(n ? [r / n | 0, gg / n | 0, b / n | 0, 255] : null);
      } g.push(row); }
    return g;
  };
  const domColor = (x0: number, y0: number, x1: number, y1: number, noSkin: boolean): RGBA => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const [pr, pg, pb, pa] = at(x, y); if (bgLike(pr, pg, pb, pa)) continue; if (noSkin && isSkin(pr, pg, pb)) continue; r += pr; g += pg; b += pb; n++; }
    return n ? [r / n | 0, g / n | 0, b / n | 0, 255] : [60, 45, 40, 255];
  };

  const skin = new PNG({ width: 64, height: 64 }); skin.data.fill(0);
  const set = (x: number, y: number, c: RGBA | null) => { if (x < 0 || y < 0 || x >= 64 || y >= 64 || !c || c[3] < 40) return; const o = (y * 64 + x) * 4; skin.data[o] = c[0]; skin.data[o + 1] = c[1]; skin.data[o + 2] = c[2]; skin.data[o + 3] = 255; };
  const fillC = (x: number, y: number, w: number, h: number, c: RGBA) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const sh = (c: RGBA | null, f: number): RGBA | null => c && c[3] >= 40 ? [c[0] * f | 0, c[1] * f | 0, c[2] * f | 0, 255] : c;
  const fr = (ox: number, oy: number, w: number, h: number, dep: number) => ({ py: [ox + dep, oy, w, dep], ny: [ox + dep + w, oy, w, dep], nx: [ox, oy + dep, dep, h], pz: [ox + dep, oy + dep, w, h], px: [ox + dep + w, oy + dep, dep, h], nz: [ox + dep + w + dep, oy + dep, w, h] } as Record<string, number[]>);
  const paintFront = (box: [number, number, number, number, number], g: (RGBA | null)[][]) => {
    const f = fr(...box), w = box[2], h = box[3], dep = box[4];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(f.pz![0]! + i, f.pz![1]! + j, g[j]?.[i] ?? null);
    for (let j = 0; j < h; j++) for (let i = 0; i < dep; i++) { set(f.nx![0]! + i, f.nx![1]! + j, sh(g[j]?.[0] ?? null, 0.85)); set(f.px![0]! + i, f.px![1]! + j, sh(g[j]?.[w - 1] ?? null, 0.85)); }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(f.nz![0]! + i, f.nz![1]! + j, sh(g[j]?.[w - 1 - i] ?? null, 0.7));
    for (let i = 0; i < w; i++) for (let k = 0; k < dep; k++) { set(f.py![0]! + i, f.py![1]! + k, sh(g[0]?.[i] ?? null, 0.9)); set(f.ny![0]! + i, f.ny![1]! + k, sh(g[h - 1]?.[i] ?? null, 0.6)); }
  };

  // ===== HEAD — layered compositor: hair volume → face → fringe → long hair → accessories.
  // Each head element lands on its own UV face(s); the cube's two layers are the whole budget.
  const hexRGBA = (h?: string): RGBA | null => { if (!h) return null; const m = /^#?([0-9a-fA-F]{6})$/.exec(h.trim()); if (!m) return null; const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };
  const rgbOf = (h: string | undefined, fb: RGB): RGB => { const c = hexRGBA(h); return c ? [c[0], c[1], c[2]] : fb; };
  const hairC: RGBA = hexRGBA(opts.hairHex) ?? domColor(minX + ((bw * 0.3) | 0), minY, minX + ((bw * 0.7) | 0), FY(faceTop), true);
  const hairRGB: RGB = [hairC[0], hairC[1], hairC[2]];
  const setRGB: Setter = (x, y, c) => set(x, y, [c[0], c[1], c[2], 255]);
  const hb = fr(0, 0, 8, 8, 8);   // head base faces
  const ho = fr(32, 0, 8, 8, 8);  // head overlay (hat) faces

  // sample face skin + eye color from the standardized image
  let fr_ = 0, fg_ = 0, fb_ = 0, fn = 0, er = 0, eg = 0, eb = 0, en = 0;
  for (let y = minY + faceTop; y <= minY + faceBot + 2; y++) for (let x = minX; x <= maxX; x++) { const [r, g, b, a] = at(x, y); if (bgLike(r, g, b, a)) continue;
    if (isSkin(r, g, b)) { fr_ += r; fg_ += g; fb_ += b; fn++; }
    else { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx >= 55 && mx <= 190 && mx - mn > mx * 0.25) { er += r; eg += g; eb += b; en++; } } }
  const faceSkin: RGBA = fn ? [fr_ / fn | 0, fg_ / fn | 0, fb_ / fn | 0, 255] : [240, 210, 190, 255];
  // Iris color: trust the VLM's read UNLESS it's the brown DEFAULT (#5a3a2a) — that means the VLM
  // didn't actually read the eyes, and overriding with it caused the "eyes went brown" regression.
  // In that case fall back to the color sampled straight from the art's face band.
  const eyeFromHex = (): RGBA | null => { if (!eyeHex || !/^#?[0-9a-fA-F]{6}$/.test(eyeHex.trim())) return null; const n = parseInt(eyeHex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };
  const vlmEye = eyeFromHex(), vlmDefault = !!eyeHex && eyeHex.replace(/^#/, "").toLowerCase() === "5a3a2a";
  const artEye: RGBA | null = en >= 2 ? [er / en | 0, eg / en | 0, eb / en | 0, 255] : null;
  const eyeC: RGBA = vlmEye && !vlmDefault ? vlmEye : artEye ?? vlmEye ?? [100, 60, 50, 255];

  // (1) hair VOLUME on the non-face faces (base + overlay): top / sides / back / underside
  for (const [rc, f] of [[hb.py, 1], [hb.nx, 0.95], [hb.px, 0.95], [hb.nz, 0.9], [hb.ny, 0.85]] as const) fillC(rc![0]!, rc![1]!, rc![2]!, rc![3]!, sh(hairC, f as number)!);
  for (const [rc, f] of [[ho.py, 1], [ho.nx, 0.95], [ho.px, 0.95], [ho.nz, 0.9]] as const) fillC(rc![0]!, rc![1]!, rc![2]!, rc![3]!, sh(hairC, f as number)!);

  // (2) FACE on the base front: skin block + crafted big anime eyes + soft mouth.
  // Per eye (2px wide): a dark upper LASH line, a 2-row IRIS in the eye color, and a white
  // highlight sparkle. Drawn deterministically (consistent every run), in the correct top-down
  // order — lash above iris, sparkle in the iris — so it reads as looking forward.
  const fx = hb.pz![0]!, fy = hb.pz![1]!;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) set(fx + i, fy + j, faceSkin);
  const wht: RGBA = [250, 250, 252, 255];
  const lashC = sh(eyeC, 0.4)!; // dark eyelid, tinted by the iris hue
  for (const ox of [1, 5]) { // left eye cols 1-2, right eye cols 5-6
    set(fx + ox, fy + 3, lashC); set(fx + ox + 1, fy + 3, lashC);   // upper lash line
    set(fx + ox, fy + 4, eyeC); set(fx + ox + 1, fy + 4, eyeC);     // iris (upper)
    set(fx + ox, fy + 5, eyeC); set(fx + ox + 1, fy + 5, eyeC);     // iris (lower)
  }
  set(fx + 2, fy + 4, wht); set(fx + 5, fy + 4, wht); // highlight sparkle (inner-top of each iris)
  set(fx + 3, fy + 6, sh(faceSkin, 0.66)); set(fx + 4, fy + 6, sh(faceSkin, 0.66)); // soft mouth

  // (3) FRINGE — per-column hairline trace onto the front overlay (captures bang shape)
  let hMinX = maxX, hMaxX = minX;
  for (let y = minY + faceTop; y <= minY + faceBot; y++) for (let x = minX; x <= maxX; x++) { const [r, g, b, a] = at(x, y); if (!bgLike(r, g, b, a)) { if (x < hMinX) hMinX = x; if (x > hMaxX) hMaxX = x; } }
  if (hMaxX < hMinX) { hMinX = minX; hMaxX = maxX; }
  const bandTop = minY + Math.max(0, faceTop - (((faceBot - faceTop) * 0.4) | 0)), bandBot = minY + faceBot;
  // Anime characters almost always have bangs, so draw a BASELINE fringe from the VLM parting style;
  // the per-column trace then DEEPENS it where hair is genuinely detectable. (Tracing alone fails:
  // Qwen's redraw washes light hair toward skin tone, so the hairline vanishes → bare "金正恩" head.)
  const FR = head?.fringe ?? "blunt";
  const eyeCol = (c: number) => c === 1 || c === 2 || c === 5 || c === 6;
  const d2 = (r: number, g: number, b: number, t: RGBA) => { const a = r - t[0], e = g - t[1], f = b - t[2]; return a * a + e * e + f * f; };
  for (let c = 0; c < 8; c++) {
    // baseline depth: forehead coverage by parting style (center parts shorter, sides longer)
    let base: number;
    if (FR === "none") base = c === 0 || c === 7 ? 4 : 1;
    else if (FR === "middle" || FR === "parted") base = c === 3 || c === 4 ? 1 : c === 0 || c === 7 ? 5 : 3;
    else if (FR === "swept") base = 2 + Math.round((c / 7) * 3);
    else base = c === 0 || c === 7 ? 5 : 3; // blunt
    // trace deepener: scan down; hair continues until a pixel is clearly SKIN (closer to the face
    // skin than to the hair color) — robust to washed pale hair, unlike a bare isSkin test.
    const ix = (hMinX + (hMaxX - hMinX) * (c + 0.5) / 8) | 0;
    let skinRow = -1;
    for (let y = bandTop; y <= bandBot; y++) { const [r, g, b, a] = at(ix, y); if (bgLike(r, g, b, a)) continue; if (d2(r, g, b, faceSkin) < d2(r, g, b, hairC) && isSkin(r, g, b)) { skinRow = y; break; } }
    const traceDepth = skinRow < 0 ? 8 : Math.round((skinRow - bandTop) / (bandBot - bandTop + 1) * 8);
    const cap = eyeCol(c) ? 3 : 6;
    const depth = Math.min(cap, Math.max(base, traceDepth));
    for (let j = 0; j < depth; j++) set(ho.pz![0]! + c, ho.pz![1]! + j, sh(hairC, j === depth - 1 ? 0.85 : 1));
  }
  // sidelocks: keep the outer front-overlay columns hair down the full face height
  if (head?.sidelocks) for (const c of [0, 7]) for (let j = 0; j < 8; j++) set(ho.pz![0]! + c, ho.pz![1]! + j, sh(hairC, 0.95));

  // (4) LONG HAIR — back overlay already hair; extend down the body's back overlay
  if (head && (head.length === "shoulder" || head.length === "long")) {
    const back = fr(16, 32, 8, 12, 4).nz!; // torso overlay, back face
    const rows = head.length === "long" ? 12 : 5;
    for (let j = 0; j < rows; j++) for (let i = 0; i < 8; i++) set(back[0]! + i, back[1]! + j, sh(hairC, 0.9 - j * 0.012));
  }

  // (5) ACCESSORIES — stencils, painted in occlusion order (hat → ears/horns → hair-acc → face-acc)
  if (head) {
    if (head.hat.type === "hood") paintHood(setRGB, rgbOf(head.hat.color, hairRGB));
    else if (head.hat.type !== "none") paintHat(setRGB, rgbOf(head.hat.color, hairRGB), head.hat.type === "cap" ? "cap" : head.hat.type === "beret" ? "beret" : "hat");
    if (head.ears.type !== "none") paintEars(setRGB, rgbOf(head.ears.color, hairRGB), head.ears.type === "other" ? "cat" : head.ears.type);
    if (head.horns.type !== "none") paintHorns(setRGB, rgbOf(head.horns.color, [232, 224, 208]), head.horns.type === "other" ? "demon" : head.horns.type);
    const acc = head.hairAccessory;
    if (acc.type === "band") paintBand(setRGB, rgbOf(acc.color, [200, 60, 70]));
    else if (acc.type === "crown") paintCrown(setRGB, rgbOf(acc.color, [220, 190, 90]));
    else if (acc.type === "ribbon" || acc.type === "clip") paintBow(setRGB, rgbOf(acc.color, [200, 60, 70]), acc.side);
    else {
      // program-side backup: the VLM said "no hair accessory", but look for a distinct-colored
      // cluster sitting IN the hair (a bow/clip the VLM missed). Scan the crown/fringe full-width
      // and the side strips below it — but skip the central face at eye level so eyes aren't caught.
      const fTop = minY + faceTop, fBot = minY + faceBot, mid = (hMinX + hMaxX) / 2, hw = hMaxX - hMinX + 1;
      let cr = 0, cg = 0, cb = 0, cxs = 0, cn = 0;
      for (let y = bandTop; y <= fBot; y++) for (let x = hMinX; x <= hMaxX; x++) {
        if (y > fTop && Math.abs(x - mid) < hw * 0.25) continue; // skip the central face/eyes
        const [r, g, b, a] = at(x, y); if (bgLike(r, g, b, a) || isSkin(r, g, b)) continue;
        const dr = r - hairC[0], dg = g - hairC[1], db = b - hairC[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (dr * dr + dg * dg + db * db > 6000 && mx - mn > 35 && mx > 60) { cr += r; cg += g; cb += b; cxs += x; cn++; }
      }
      const area = hw * (fBot - bandTop + 1);
      if (cn >= 5 && cn < area * 0.22) {
        const cxAvg = cxs / cn, m = hw * 0.12;
        const side = cxAvg < mid - m ? "left" : cxAvg > mid + m ? "right" : "center";
        paintBow(setRGB, [cr / cn | 0, cg / cn | 0, cb / cn | 0], side);
      }
    }
    if (head.faceAccessory.type !== "none") paintFaceAcc(setRGB, rgbOf(head.faceAccessory.color, [40, 40, 40]), head.faceAccessory.type, 4);
  }

  // TORSO / ARMS / LEGS — projected real pixels
  const tY0 = FY(headBot), tY1 = FY(legStart), tcx0 = minX + ((bw * 0.30) | 0), tcx1 = minX + ((bw * 0.70) | 0);
  paintFront([16, 16, 8, 12, 4], grid(tcx0, tY0, tcx1, tY1, 8, 12));
  paintFront([40, 16, 4, 12, 4], grid(minX + ((bw * 0.13) | 0), tY0, tcx0, tY1, 4, 12));
  paintFront([32, 48, 4, 12, 4], grid(tcx1, tY0, minX + ((bw * 0.87) | 0), tY1, 4, 12));
  const lY0 = FY(legStart), lY1 = maxY, lmid = ((minX + maxX) / 2) | 0;
  paintFront([0, 16, 4, 12, 4], grid(minX + ((bw * 0.34) | 0), lY0, lmid, lY1, 4, 12));
  paintFront([16, 48, 4, 12, 4], grid(lmid, lY0, minX + ((bw * 0.66) | 0), lY1, 4, 12));

  // FRONT-FALLING LONG HAIR — hair draping over the shoulders/chest in the 立绘 is real, visible
  // pixels (not background). Project it onto the body OVERLAY layer so it sits IN FRONT of the
  // garment; keep only hair-colored cells so the outfit shows everywhere else.
  if (head && (head.length === "long" || head.length === "shoulder")) {
    const isHair = (c: RGBA | null): boolean => {
      if (!c || isSkin(c[0], c[1], c[2])) return false;
      const dr = c[0] - hairC[0], dg = c[1] - hairC[1], db = c[2] - hairC[2];
      return dr * dr + dg * dg + db * db < 4600; // close to the sampled hair color
    };
    const overlayHair = (box: [number, number, number, number, number], g: (RGBA | null)[][]) => {
      const f = fr(...box);
      for (let j = 0; j < box[3]; j++) for (let i = 0; i < box[2]; i++) { const c = g[j]?.[i] ?? null; if (isHair(c)) set(f.pz![0]! + i, f.pz![1]! + j, c); }
    };
    overlayHair([16, 32, 8, 12, 4], grid(tcx0, tY0, tcx1, tY1, 8, 12)); // torso overlay (jacket layer)
    overlayHair([40, 32, 4, 12, 4], grid(minX + ((bw * 0.13) | 0), tY0, tcx0, tY1, 4, 12)); // right-arm overlay (image left)
    overlayHair([48, 48, 4, 12, 4], grid(tcx1, tY0, minX + ((bw * 0.87) | 0), tY1, 4, 12)); // left-arm overlay (image right)
  }

  return new Uint8Array(PNG.sync.write(skin));
}

/**
 * Stamp the FACE square only (base-front UV [8,8]–[15,15]) from `faceSrc` (a recolored real base —
 * precise hand-drawn eyes/lash/whites) onto `dst` (the compositor skin), keeping ALL of the
 * compositor's hair / fringe / accessories / overlay. Best of both: a crafted face under the
 * character's own hair. The face square is bordered by hair on every side, so a small skin-tone
 * seam is hidden.
 */
export function mergeFace(dst: Uint8Array, faceSrc: Uint8Array): Uint8Array {
  const d = PNG.sync.read(Buffer.from(dst)), s = PNG.sync.read(Buffer.from(faceSrc));
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) {
    const o = (y * 64 + x) * 4;
    if ((s.data[o + 3] ?? 0) < 40) continue; // keep dst where the base face is transparent
    d.data[o] = s.data[o]!; d.data[o + 1] = s.data[o + 1]!; d.data[o + 2] = s.data[o + 2]!; d.data[o + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(d));
}
