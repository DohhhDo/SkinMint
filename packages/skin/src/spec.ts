import { SkinCanvas, faceRects } from "./canvas";
import type { VisionProvider } from "./vision";

type RGB = [number, number, number];
type Rect = [number, number, number, number];

export type HairStyle = "short" | "bob" | "long" | "twin_tails" | "ponytail";
export type TopType = "shirt" | "dress" | "jacket" | "armor" | "robe";
export type BottomType = "pants" | "skirt" | "shorts" | "dress";
export type Legwear = "none" | "stockings" | "tights";
export type Headwear = "none" | "hat" | "hood" | "ears" | "horns";

/** Structured character features extracted from a 立绘 — drives the renderer. */
export interface CharacterSpec {
  skin: string;
  gender: "m" | "f" | "n";
  hair: { color: string; style: HairStyle };
  eyes: { color: string };
  headwear: { type: Headwear; color?: string };
  top: { type: TopType; colors: string[] };
  bottom: { type: BottomType; colors: string[] };
  legwear: Legwear;
  shoes: { color: string };
  accents: string[];
}

function hex(hex: string, fb: RGB): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return fb;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const shade = ([r, g, b]: RGB, f: number): RGB => [Math.min(255, Math.round(r * f)), Math.min(255, Math.round(g * f)), Math.min(255, Math.round(b * f))];
const r4 = (c: SkinCanvas, r: Rect, col: RGB, a = 255) => c.rect(r[0], r[1], r[2], r[3], col, a);

/** Paint a limb: `upper` color, bottom `lowerRows` (hands/shoes) in `lower`. */
function limb(c: SkinCanvas, ox: number, oy: number, w: number, h: number, d: number, upper: RGB, lower: RGB, lowerRows: number) {
  c.fillBox(ox, oy, w, h, d, upper);
  if (lowerRows <= 0) return;
  const f = faceRects(ox, oy, w, h, d);
  const ly = oy + d + h - lowerRows;
  r4(c, [f.nx[0], ly, d, lowerRows], lower);
  r4(c, [f.pz[0], ly, w, lowerRows], lower);
  r4(c, [f.px[0], ly, d, lowerRows], lower);
  r4(c, [f.nz[0], ly, w, lowerRows], lower);
  r4(c, f.ny, lower);
}

/**
 * Render a clean 64×64 Minecraft skin from a CharacterSpec — deterministic part
 * composition (always legal + complete). Captures FEATURES (hairstyle, eyes,
 * headwear, outfit type, legwear, colors), not every detail.
 */
export function renderSkinFromSpec(s: CharacterSpec): Uint8Array {
  const skin = hex(s.skin, [240, 214, 192]);
  const hair = hex(s.hair.color, [58, 42, 34]);
  const eyes = hex(s.eyes.color, [90, 58, 42]);
  const top = hex(s.top.colors?.[0] ?? "", [106, 106, 114]);
  const top2 = hex(s.top.colors?.[1] ?? "", shade(top, 0.7));
  const bottom = hex(s.bottom.colors?.[0] ?? "", [51, 56, 74]);
  const shoes = hex(s.shoes.color, [42, 42, 42]);
  const accent = hex(s.accents?.[0] ?? "", shade(top, 0.6));
  const sock = s.legwear === "stockings" || s.legwear === "tights" ? shade(bottom, 0.55) : bottom;
  const c = new SkinCanvas();

  // ---- base ----
  c.fillBox(0, 0, 8, 8, 8, skin); // head
  c.fillBox(16, 16, 8, 12, 4, top); // body
  limb(c, 40, 16, 4, 12, 4, top, skin, s.top.type === "armor" ? 2 : 3); // right arm
  limb(c, 32, 48, 4, 12, 4, top, skin, s.top.type === "armor" ? 2 : 3); // left arm
  // legs: stockings cover most, shoes at the foot
  limb(c, 0, 16, 4, 12, 4, s.legwear !== "none" ? sock : bottom, shoes, 3); // right leg
  limb(c, 16, 48, 4, 12, 4, s.legwear !== "none" ? sock : bottom, shoes, 3); // left leg
  // skirt impression: top rows of legs take the bottom/skirt color
  if (s.bottom.type === "skirt" || s.bottom.type === "dress") {
    for (const [ox, oy] of [[0, 16], [16, 48]] as const) {
      const f = faceRects(ox, oy, 4, 12, 4);
      for (const fc of [f.nx, f.pz, f.px, f.nz]) r4(c, [fc[0], oy + 4, fc[2], 3], bottom);
    }
  }

  // depth on side/back faces
  const hf = faceRects(0, 0, 8, 8, 8);
  const bf = faceRects(16, 16, 8, 12, 4);
  r4(c, bf.nx, shade(top, 0.92)); r4(c, bf.px, shade(top, 0.92)); r4(c, bf.nz, shade(top, 0.88));

  // ---- top detailing: collar / trim ----
  if (s.top.type === "dress" || s.top.type === "robe" || s.top.type === "jacket") {
    r4(c, [bf.pz[0], bf.pz[1], 8, 2], top2); // collar band
    r4(c, [bf.pz[0] + 3, bf.pz[1], 2, 12], shade(top, 0.85)); // center seam
  }
  r4(c, [bf.pz[0], bf.pz[1] + 8, 8, 1], accent); // waist/belt accent

  // ---- hair (base top/back/sides + bangs + overlay volume) ----
  r4(c, hf.py, hair);
  r4(c, hf.nz, shade(hair, 0.9));
  r4(c, hf.nx, shade(hair, 0.95));
  r4(c, hf.px, shade(hair, 0.95));
  r4(c, [hf.pz[0], hf.pz[1], 8, 2], hair); // bangs
  const oh = faceRects(32, 0, 8, 8, 8); // overlay hat layer
  r4(c, oh.py, hair); r4(c, oh.nz, hair); r4(c, oh.nx, hair); r4(c, oh.px, hair);
  r4(c, [oh.pz[0], oh.pz[1], 8, 3], hair); // overlay bangs
  // long / tails: extend hair down the body's back + sides (overlay jacket layer at 16,32)
  if (s.hair.style === "long" || s.hair.style === "twin_tails" || s.hair.style === "ponytail") {
    const oj = faceRects(16, 32, 8, 12, 4);
    r4(c, oj.nz, shade(hair, 0.92)); // hair down the back
    if (s.hair.style === "twin_tails") { r4(c, oj.nx, shade(hair, 0.95)); r4(c, oj.px, shade(hair, 0.95)); } // tails at the sides
  }

  // ---- headwear over the hair ----
  if (s.headwear.type === "hat" || s.headwear.type === "hood") {
    const hc = hex(s.headwear.color ?? "", shade(hair, 0.6));
    r4(c, oh.py, hc); r4(c, oh.nx, hc); r4(c, oh.px, hc); r4(c, oh.nz, hc);
    r4(c, [oh.pz[0], oh.pz[1], 8, 2], hc); // brim
  }

  // ---- face: eyes + mouth ----
  const white: RGB = [245, 245, 245];
  r4(c, [10, 11, 2, 1], white); r4(c, [12, 11, 2, 1], white);
  c.set(10, 12, eyes[0], eyes[1], eyes[2]); c.set(13, 12, eyes[0], eyes[1], eyes[2]);
  r4(c, [11, 14, 2, 1], shade(skin, 0.72)); // mouth

  return c.toPNG();
}

const SPEC_INSTRUCTION = `Analyze this anime character and output ONLY a compact JSON describing its FEATURES for a Minecraft skin (use real dominant colors as hex):
{"skin":"#rrggbb","gender":"m|f|n","hair":{"color":"#rrggbb","style":"short|bob|long|twin_tails|ponytail"},"eyes":{"color":"#rrggbb"},"headwear":{"type":"none|hat|hood|ears|horns","color":"#rrggbb"},"top":{"type":"shirt|dress|jacket|armor|robe","colors":["#rrggbb","#rrggbb"]},"bottom":{"type":"pants|skirt|shorts|dress","colors":["#rrggbb"]},"legwear":"none|stockings|tights","shoes":{"color":"#rrggbb"},"accents":["#rrggbb"]}
gender: "m" male-presenting, "f" female-presenting, "n" if unclear/non-human. Output the JSON only, no other text.`;

function pickHex(v: unknown, fb: string): string {
  return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim()) ? (v.trim().startsWith("#") ? v.trim() : "#" + v.trim()) : fb;
}

/** Read a character image into a structured CharacterSpec via a vision model. */
export async function extractCharacterSpec(image: Uint8Array, opts: { vision: VisionProvider; mime?: string }): Promise<CharacterSpec> {
  const text = await opts.vision.read(image, SPEC_INSTRUCTION, opts.mime);
  const m = text.match(/\{[\s\S]*\}/);
  let raw: any = {};
  try { raw = m ? JSON.parse(m[0]) : {}; } catch { /* defaults */ }
  const colors = (v: unknown, fbs: string[]): string[] => {
    const arr = (Array.isArray(v) ? v : []).filter((x) => typeof x === "string").map((x) => pickHex(x, fbs[0]!)).slice(0, 2);
    return arr.length ? arr : fbs;
  };
  const oneOf = <T extends string>(v: unknown, allow: readonly T[], fb: T): T => (typeof v === "string" && (allow as readonly string[]).includes(v) ? (v as T) : fb);
  return {
    skin: pickHex(raw.skin, "#f0d6c0"),
    gender: oneOf(raw.gender, ["m", "f", "n"] as const, "n"),
    hair: { color: pickHex(raw.hair?.color, "#3a2a22"), style: oneOf(raw.hair?.style, ["short", "bob", "long", "twin_tails", "ponytail"], "long") },
    eyes: { color: pickHex(raw.eyes?.color, "#5a3a2a") },
    headwear: { type: oneOf(raw.headwear?.type, ["none", "hat", "hood", "ears", "horns"], "none"), color: typeof raw.headwear?.color === "string" ? pickHex(raw.headwear.color, "#333333") : undefined },
    top: { type: oneOf(raw.top?.type, ["shirt", "dress", "jacket", "armor", "robe"], "shirt"), colors: colors(raw.top?.colors, ["#6a6a72", "#4a4a52"]) },
    bottom: { type: oneOf(raw.bottom?.type, ["pants", "skirt", "shorts", "dress"], "pants"), colors: colors(raw.bottom?.colors, ["#33384a"]) },
    legwear: oneOf(raw.legwear, ["none", "stockings", "tights"], "none"),
    shoes: { color: pickHex(raw.shoes?.color, "#2a2a2a") },
    accents: Array.isArray(raw.accents) ? raw.accents.map((x: unknown) => pickHex(x, "#cc3333")).slice(0, 3) : [],
  };
}
