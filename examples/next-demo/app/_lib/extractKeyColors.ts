import { resolveVisionProvider } from "../_ai/providers";

// The identity-critical colors a pixel sampler can't get: eyes are tiny, and a
// standout accent (ribbon/bow/tie) is small but defines the character. A VLM reads
// them semantically. Bulk colors (skin/hair/top/bottom) still come from client sampling.
const INSTRUCTION = `You are reading an anime character illustration to build a Minecraft skin. Reply with ONLY one compact JSON object, no prose.
Color values are hex strings, or null if absent:
"hair": the main hair color (the dominant strands, ignore highlights and the dark outline).
"eyes": the iris color.
"top": the main color of the upper-body garment (shirt/jacket/dress top) — the large fabric area, NOT the trim or lineart. For a mostly-white garment, report white.
"bottom": the main color of the lower-body garment (skirt/pants/dress lower). null if not visible.
"accent": the single most prominent SMALL decorative color — a ribbon, bow, necktie, hair ornament, or emblem that stands out against the main outfit. null if nothing small stands out.
Structure values:
"gender": "m" (male-presenting), "f" (female-presenting), or "n" if unclear/non-human.
"lower": "skirt" if a SEPARATE top + skirt (e.g. school uniform, blouse and skirt); "dress" if a SINGLE one-piece dress, gown, robe, or kimono; "pants" if trousers, shorts, leggings, a bodysuit, or hakama.
Read the ACTUAL colors from THIS image — never copy the placeholders below.
Shape only: {"hair":"#RRGGBB","eyes":"#RRGGBB","top":"#RRGGBB","bottom":"#RRGGBB or null","accent":"#RRGGBB or null","gender":"m|f|n","lower":"skirt|dress|pants"}`;

function pickHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.match(/[0-9a-fA-F]{6}/);
  return m ? "#" + m[0].toLowerCase() : undefined;
}
function pickEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : undefined;
}

export interface KeyColors { hair?: string; eyes?: string; top?: string; bottom?: string; accent?: string; gender?: "m" | "f" | "n"; lower?: "skirt" | "pants" | "dress" }

/** VLM → colors + structure. Returns {} on any failure (graceful: bulk recolor still runs). */
export async function extractKeyColors(image: Uint8Array, mime: string): Promise<KeyColors> {
  try {
    const txt = await resolveVisionProvider().read(image, INSTRUCTION, mime);
    const j = txt.match(/\{[\s\S]*\}/);
    if (!j) return {};
    const obj = JSON.parse(j[0]) as Record<string, unknown>;
    return {
      hair: pickHex(obj.hair), eyes: pickHex(obj.eyes), top: pickHex(obj.top), bottom: pickHex(obj.bottom), accent: pickHex(obj.accent),
      gender: pickEnum(obj.gender, ["m", "f", "n"] as const), lower: pickEnum(obj.lower, ["skirt", "pants", "dress"] as const),
    };
  } catch {
    return {};
  }
}

/** Squared RGB distance between two hex colors. */
export function hexDist(a: string, b: string): number {
  const p = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return (r1! - r2!) ** 2 + (g1! - g2!) ** 2 + (b1! - b2!) ** 2;
}
