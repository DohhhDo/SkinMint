import { PNG } from "pngjs";

export interface SampledColors { skin?: string; hair?: string; top?: string; bottom?: string; shoes?: string }

/**
 * Server-side region color sampler (the node twin of `sampleColors.ts`): flood-fill the background
 * from the border (handles white↔grey gradients), then take the dominant non-skin color of each
 * vertical band (hair/top/bottom/shoes) plus the skin mode. Used to feed base retrieval+recolor for
 * the HEAD half of the hybrid (face from a real base) — the body comes from front-projection.
 */
export function sampleColorsNode(png: PNG): SampledColors {
  const W = png.width, H = png.height, d = png.data;
  const px = (x: number, y: number) => { const i = (y * W + x) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]; };
  const isSkin = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 175 && mx <= 252 && mx - mn >= 14 && mx - mn <= 95; };
  const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mode = (arr: number[][]) => { if (!arr.length) return null; const m = new Map<number, number[]>(); for (const [r, g, b] of arr) { const k = ((r! >> 3) << 10) | ((g! >> 3) << 5) | (b! >> 3); const e = m.get(k) || [0, 0, 0, 0]; e[0]! += r!; e[1]! += g!; e[2]! += b!; e[3]!++; m.set(k, e); } let bs: number[] | null = null; for (const e of m.values()) if (!bs || e[3]! > bs[3]!) bs = e; return bs ? [bs[0]! / bs[3]!, bs[1]! / bs[3]!, bs[2]! / bs[3]!] : null; };
  const bgLike = (r: number, g: number, b: number, a: number) => a < 40 || (Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 18);
  const bg = new Uint8Array(W * H), st: number[] = [];
  const seed = (x: number, y: number) => { const i = y * W + x; if (!bg[i]) { const [r, g, b, a] = px(x, y); if (bgLike(r!, g!, b!, a!)) { bg[i] = 1; st.push(i); } } };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); } for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  for (let h = 0; h < st.length; h++) { const i = st[h]!, x = i % W, y = (i / W) | 0; if (x > 0) seed(x - 1, y); if (x < W - 1) seed(x + 1, y); if (y > 0) seed(x, y - 1); if (y < H - 1) seed(x, y + 1); }
  let bgD = bg; for (let p = 0; p < 2; p++) { const n = bgD.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (bgD[y * W + x]) continue; if ((x > 0 && bgD[y * W + x - 1]) || (x < W - 1 && bgD[y * W + x + 1]) || (y > 0 && bgD[(y - 1) * W + x]) || (y < H - 1 && bgD[(y + 1) * W + x])) n[y * W + x] = 1; } bgD = n; }
  const isBg = (x: number, y: number) => bgD[y * W + x] === 1;
  let minY = H, maxY = 0, minX = W, maxX = 0, any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (bg[y * W + x] !== 1) { any = true; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; } }
  if (!any) return {};
  const ch = maxY - minY + 1;
  const region = (f0: number, f1: number) => { const a: number[][] = []; const y0 = (minY + f0 * ch) | 0, y1 = (minY + f1 * ch) | 0; for (let y = y0; y < y1; y++) for (let x = minX; x <= maxX; x++) { if (isBg(x, y)) continue; const [r, g, b] = px(x, y); if (isSkin(r!, g!, b!)) continue; a.push([r!, g!, b!]); } return a; };
  const skinPx: number[][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (isBg(x, y)) continue; const [r, g, b] = px(x, y); if (isSkin(r!, g!, b!)) skinPx.push([r!, g!, b!]); }
  const c = (arr: number[][]) => { const m = mode(arr); return m ? hex(m) : undefined; };
  return { skin: c(skinPx), hair: c(region(0, 0.2)), top: c(region(0.22, 0.46)), bottom: c(region(0.52, 0.82)), shoes: c(region(0.9, 1.0)) };
}
