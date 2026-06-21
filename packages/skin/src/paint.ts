import { SkinCanvas, faceRects } from "./canvas";
import { HFVisionProvider, type VisionProvider } from "./vision";

type RGB = [number, number, number];

/** Per-region colors for a Minecraft skin, as hex strings. */
export interface SkinPalette {
  hair: string;
  skin: string;
  eyes: string;
  top: string; // upper clothing
  bottom: string; // lower clothing / skirt / pants / stockings
  shoes: string;
}

function hexToRgb(hex: string, fallback: RGB = [128, 128, 128]): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const shade = ([r, g, b]: RGB, f: number): RGB => [Math.round(r * f), Math.round(g * f), Math.round(b * f)];

const rrect = (c: SkinCanvas, r: [number, number, number, number], color: RGB, a = 255) => c.rect(r[0], r[1], r[2], r[3], color, a);

/** Paint a limb: `upper` color, with the bottom `lowerRows` (hands / shoes) in `lower`. */
function paintLimb(c: SkinCanvas, ox: number, oy: number, w: number, h: number, d: number, upper: RGB, lower: RGB, lowerRows: number) {
  c.fillBox(ox, oy, w, h, d, upper);
  if (lowerRows <= 0) return;
  const f = faceRects(ox, oy, w, h, d);
  const ly = oy + d + h - lowerRows;
  rrect(c, [f.nx[0], ly, d, lowerRows], lower);
  rrect(c, [f.pz[0], ly, w, lowerRows], lower);
  rrect(c, [f.px[0], ly, d, lowerRows], lower);
  rrect(c, [f.nz[0], ly, w, lowerRows], lower);
  rrect(c, f.ny, lower); // bottom cap (sole / underside of hand)
}

/**
 * Paint a clean 64×64 Minecraft skin from a palette — deterministic, always
 * complete, always with a face. Flat blocky colors suit the medium and avoid
 * the muddy output of text→skin models.
 */
export function paintSkinFromPalette(p: SkinPalette): Uint8Array {
  const hair = hexToRgb(p.hair, [58, 42, 34]);
  const skin = hexToRgb(p.skin, [232, 185, 140]);
  const eyes = hexToRgb(p.eyes, [90, 58, 42]);
  const top = hexToRgb(p.top, [106, 106, 114]);
  const bottom = hexToRgb(p.bottom, [51, 56, 74]);
  const shoes = hexToRgb(p.shoes, [42, 42, 42]);

  const c = new SkinCanvas();

  // ---- base layer ----
  c.fillBox(0, 0, 8, 8, 8, skin); // head (face = skin)
  c.fillBox(16, 16, 8, 12, 4, top); // body
  paintLimb(c, 40, 16, 4, 12, 4, top, skin, 3); // right arm — sleeve + bare hand
  paintLimb(c, 32, 48, 4, 12, 4, top, skin, 3); // left arm
  paintLimb(c, 0, 16, 4, 12, 4, bottom, shoes, 4); // right leg — leg + shoe
  paintLimb(c, 16, 48, 4, 12, 4, bottom, shoes, 4); // left leg

  // a touch of depth: darken the side/back faces slightly
  const hf = faceRects(0, 0, 8, 8, 8);
  rrect(c, hf.nz, shade(skin, 0.92));
  const bf = faceRects(16, 16, 8, 12, 4);
  rrect(c, bf.nz, shade(top, 0.9));
  rrect(c, bf.nx, shade(top, 0.95));
  rrect(c, bf.px, shade(top, 0.95));

  // ---- hair: base (top/back/sides + bangs) + overlay hat for volume ----
  rrect(c, hf.py, hair);
  rrect(c, hf.nz, shade(hair, 0.9));
  rrect(c, hf.nx, shade(hair, 0.95));
  rrect(c, hf.px, shade(hair, 0.95));
  rrect(c, [hf.pz[0], hf.pz[1], 8, 2], hair); // bangs over forehead
  const of = faceRects(32, 0, 8, 8, 8); // overlay hat layer
  rrect(c, of.py, hair);
  rrect(c, of.nz, hair);
  rrect(c, of.nx, hair);
  rrect(c, of.px, hair);
  rrect(c, [of.pz[0], of.pz[1], 8, 3], hair); // overlay bangs

  // ---- face: eyes + mouth on the front (pz of head = [8,8]) ----
  const white: RGB = [245, 245, 245];
  rrect(c, [10, 11, 2, 1], white);
  rrect(c, [12, 11, 2, 1], white);
  c.set(10, 12, eyes[0], eyes[1], eyes[2]);
  c.set(13, 12, eyes[0], eyes[1], eyes[2]);
  rrect(c, [11, 14, 2, 1], shade(skin, 0.72)); // mouth

  return c.toPNG();
}

const PALETTE_INSTRUCTION = `Look at this character and output ONLY a compact JSON object of hex colors for a Minecraft skin, using the character's actual dominant colors:
{"hair":"#xxxxxx","skin":"#xxxxxx","eyes":"#xxxxxx","top":"#xxxxxx","bottom":"#xxxxxx","shoes":"#xxxxxx"}
"top" = upper clothing, "bottom" = lower clothing/skirt/pants/stockings. Output the JSON only, no other text.`;

/** Read a character image into a per-region color palette via a vision model. */
export async function extractSkinPalette(
  image: Uint8Array,
  opts: { vision?: VisionProvider; hfToken?: string; mime?: string; fetch?: typeof fetch },
): Promise<SkinPalette> {
  const vision = opts.vision ?? new HFVisionProvider({ hfToken: opts.hfToken!, fetch: opts.fetch });
  const text = await vision.read(image, PALETTE_INSTRUCTION, opts.mime);
  const m = text.match(/\{[\s\S]*\}/);
  let raw: Record<string, unknown> = {};
  try {
    raw = m ? JSON.parse(m[0]) : {};
  } catch {
    /* keep defaults */
  }
  const hex = (v: unknown, fb: string) =>
    typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim()) ? (v.trim().startsWith("#") ? v.trim() : "#" + v.trim()) : fb;
  return {
    hair: hex(raw.hair, "#3a2a22"),
    skin: hex(raw.skin, "#e8b98c"),
    eyes: hex(raw.eyes, "#5a3a2a"),
    top: hex(raw.top, "#6a6a72"),
    bottom: hex(raw.bottom, "#33384a"),
    shoes: hex(raw.shoes, "#2a2a2a"),
  };
}
