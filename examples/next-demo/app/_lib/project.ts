import { PNG } from "pngjs";

type RGBA = [number, number, number, number];

/**
 * Build a 64×64 Minecraft skin by FRONT-PROJECTING a standardized full-body, front-facing
 * character image onto the skin's front UV faces — real pixels, NO base library. Clothing/body
 * come straight from the image (so a black blazer is actually black); side/back/top faces are a
 * shaded copy of the front; the FACE is drawn (skin tone + irises), since an 8×8 projection of a
 * 立绘 face is always a blur. `eyeHex` (from the VLM) overrides the detected iris color.
 */
export function projectSkin(imageBuf: Buffer, eyeHex?: string): Uint8Array {
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
  const fillBox = (box: [number, number, number, number, number], c: RGBA) => { const f = fr(...box); for (const r of Object.values(f)) fillC(r[0]!, r[1]!, r[2]!, r[3]!, c); };

  // HEAD — hair fills the head; face is DRAWN (skin + irises), not projected.
  const hairC = domColor(minX + ((bw * 0.3) | 0), minY, minX + ((bw * 0.7) | 0), FY(faceTop), true);
  fillBox([0, 0, 8, 8, 8], hairC);
  let fr_ = 0, fg_ = 0, fb_ = 0, fn = 0, er = 0, eg = 0, eb = 0, en = 0;
  for (let y = minY + faceTop; y <= minY + faceBot + 2; y++) for (let x = minX; x <= maxX; x++) { const [r, g, b, a] = at(x, y); if (bgLike(r, g, b, a)) continue;
    if (isSkin(r, g, b)) { fr_ += r; fg_ += g; fb_ += b; fn++; }
    else { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx >= 55 && mx <= 190 && mx - mn > mx * 0.25) { er += r; eg += g; eb += b; en++; } } }
  const faceSkin: RGBA = fn ? [fr_ / fn | 0, fg_ / fn | 0, fb_ / fn | 0, 255] : [240, 210, 190, 255];
  let eyeC: RGBA = en ? [er / en | 0, eg / en | 0, eb / en | 0, 255] : [100, 60, 50, 255];
  if (eyeHex && /^#?[0-9a-fA-F]{6}$/.test(eyeHex.trim())) { const n = parseInt(eyeHex.replace("#", ""), 16); eyeC = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }
  const fbx = fr(0, 0, 8, 8, 8);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) set(fbx.pz![0]! + i, fbx.pz![1]! + j, j < 2 ? hairC : faceSkin);
  for (const ex of [1, 2, 5, 6]) set(fbx.pz![0]! + ex, fbx.pz![1]! + 4, eyeC);

  // TORSO / ARMS / LEGS — projected real pixels
  const tY0 = FY(headBot), tY1 = FY(legStart), tcx0 = minX + ((bw * 0.30) | 0), tcx1 = minX + ((bw * 0.70) | 0);
  paintFront([16, 16, 8, 12, 4], grid(tcx0, tY0, tcx1, tY1, 8, 12));
  paintFront([40, 16, 4, 12, 4], grid(minX + ((bw * 0.13) | 0), tY0, tcx0, tY1, 4, 12));
  paintFront([32, 48, 4, 12, 4], grid(tcx1, tY0, minX + ((bw * 0.87) | 0), tY1, 4, 12));
  const lY0 = FY(legStart), lY1 = maxY, lmid = ((minX + maxX) / 2) | 0;
  paintFront([0, 16, 4, 12, 4], grid(minX + ((bw * 0.34) | 0), lY0, lmid, lY1, 4, 12));
  paintFront([16, 48, 4, 12, 4], grid(lmid, lY0, minX + ((bw * 0.66) | 0), lY1, 4, 12));

  return new Uint8Array(PNG.sync.write(skin));
}

/**
 * Merge two 64×64 skins: the HEAD rows (y<16, the head + hat-overlay band) from `head` (a recolored
 * real base — precise hand-drawn face/eyes), the BODY (y≥16) from `body` (the front-projection —
 * real garment pixels). Best of both: a crafted face on a faithfully-colored body.
 */
export function mergeHeadBody(head: Uint8Array, body: Uint8Array): Uint8Array {
  const hp = PNG.sync.read(Buffer.from(head)), bp = PNG.sync.read(Buffer.from(body));
  const out = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const o = (y * 64 + x) * 4, src = y < 16 ? hp : bp;
    out.data[o] = src.data[o]!; out.data[o + 1] = src.data[o + 1]!; out.data[o + 2] = src.data[o + 2]!; out.data[o + 3] = src.data[o + 3]!;
  }
  return new Uint8Array(PNG.sync.write(out));
}
