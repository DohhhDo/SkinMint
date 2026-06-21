export interface SampledColors {
  skin?: string;
  hair?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
}

/**
 * Sample per-region colors from a 立绘 in the browser canvas — anchored to the
 * character bounding box (framing-robust) with skin pixels excluded so the face
 * doesn't pollute hair. Skin itself is the mode of skin-hue pixels. Runs
 * client-side (the browser already has the 立绘); the route merges these with
 * the vision model's semantic spec.
 */
export function sampleColors(dataUrl: string): Promise<SampledColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve({});
    img.onload = () => {
      try {
        const W = 192, H = Math.max(1, Math.round((192 * img.height) / img.width));
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;
        const px = (x: number, y: number) => { const i = (y * W + x) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]; };
        const isSkin = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return r >= g && g >= b - 8 && r - b >= 16 && r - b <= 95 && mx >= 175 && mx <= 252 && mx - mn >= 14 && mx - mn <= 95; };
        const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
        const mode = (arr: number[][]) => {
          if (!arr.length) return null;
          const m = new Map<number, number[]>();
          for (const [r, g, b] of arr) { const k = ((r! >> 3) << 10) | ((g! >> 3) << 5) | (b! >> 3); const e = m.get(k) || [0, 0, 0, 0]; e[0]! += r!; e[1]! += g!; e[2]! += b!; e[3]!++; m.set(k, e); }
          let best: number[] | null = null;
          for (const e of m.values()) if (!best || e[3]! > best[3]!) best = e;
          return best ? [best[0]! / best[3]!, best[1]! / best[3]!, best[2]! / best[3]!] : null;
        };
        // Background = transparent OR near-white low-chroma (covers a white↔light-gray
        // gradient bg) that is REACHABLE from the image border. Flooding from the border
        // (not a global near-white test) is what keeps interior WHITE CLOTHING — the old
        // global test ate it, so the top mode fell onto dark lineart → muddy dark skins.
        const bgLike = (r: number, g: number, b: number, a: number) => a < 40 || (Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 18);
        const bg = new Uint8Array(W * H);
        const stack: number[] = [];
        const seed = (x: number, y: number) => { const i = y * W + x; if (!bg[i]) { const [r, g, b, a] = px(x, y); if (bgLike(r!, g!, b!, a!)) { bg[i] = 1; stack.push(i); } } };
        for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
        for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
        for (let h = 0; h < stack.length; h++) { const i = stack[h]!, x = i % W, y = (i / W) | 0;
          if (x > 0) seed(x - 1, y); if (x < W - 1) seed(x + 1, y); if (y > 0) seed(x, y - 1); if (y < H - 1) seed(x, y + 1); }
        // Dilate bg by 2px so the anti-alias halo (light-gray ring, same color as white bg)
        // is excluded from sampling; real white clothing is thicker and survives.
        let bgD = bg;
        for (let pass = 0; pass < 2; pass++) { const n = bgD.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (bgD[y * W + x]) continue; if ((x > 0 && bgD[y * W + x - 1]) || (x < W - 1 && bgD[y * W + x + 1]) || (y > 0 && bgD[(y - 1) * W + x]) || (y < H - 1 && bgD[(y + 1) * W + x])) n[y * W + x] = 1; } bgD = n; }
        const isBg = (x: number, y: number) => bgD[y * W + x] === 1;
        let minY = H, maxY = 0, minX = W, maxX = 0, any = false;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (bg[y * W + x] !== 1) { any = true; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; } }
        if (!any) { resolve({}); return; }
        const ch = maxY - minY + 1;
        const region = (f0: number, f1: number) => { const a: number[][] = []; const y0 = (minY + f0 * ch) | 0, y1 = (minY + f1 * ch) | 0; for (let y = y0; y < y1; y++) for (let x = minX; x <= maxX; x++) { if (isBg(x, y)) continue; const [r, g, b] = px(x, y); if (isSkin(r!, g!, b!)) continue; a.push([r!, g!, b!]); } return a; };
        const skinPx: number[][] = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (isBg(x, y)) continue; const [r, g, b] = px(x, y); if (isSkin(r!, g!, b!)) skinPx.push([r!, g!, b!]); }
        const c = (arr: number[][]) => { const m = mode(arr); return m ? hex(m) : undefined; };
        resolve({ skin: c(skinPx), hair: c(region(0, 0.2)), top: c(region(0.22, 0.46)), bottom: c(region(0.52, 0.82)), shoes: c(region(0.9, 1.0)) });
      } catch {
        resolve({});
      }
    };
    img.src = dataUrl;
  });
}
