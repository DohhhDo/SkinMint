// Optional "AI 看图" step: caption the 立绘 with a vision-language model on the
// Hugging Face router (Qwen3-VL). Reimplemented standalone — same proven router
// contract the main project uses, but no @skinmint import. Borrows HF_TOKEN.

const ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const MODEL = "Qwen/Qwen3-VL-8B-Instruct";

// Archetypes must match the base-skin library filenames in bases/.
export const ARCHETYPES = ["schoolgirl", "dress", "hoodie", "kimono", "sporty", "coat"];

const COLOR_INSTRUCTION =
  "You are analyzing an anime character illustration to recolor a Minecraft skin. " +
  "Return ONLY a compact JSON object (no prose, no code fence) with: " +
  "hex color strings for hair, eyes, skin, top, bottom, accent; and an 'archetype' " +
  "string that is the SINGLE best match from this list for the character's outfit: " +
  `${JSON.stringify(ARCHETYPES)}. ` +
  "top = jacket/shirt main color; bottom = skirt/pants main color; accent = the most " +
  "distinctive small accent (ribbon/bow/tie). archetype: schoolgirl=blazer/sailor uniform, " +
  "dress=one-piece/gown, hoodie=casual hoodie, kimono=japanese kimono/yukata, sporty=athletic/jacket+shorts, coat=long coat/suit. " +
  'Example: {"archetype":"schoolgirl","hair":"#101010","eyes":"#cc1f2e","skin":"#f3ddc8","top":"#1b1d2a","bottom":"#3a52a0","accent":"#cc1f2e"}';

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Ask the VLM for the character's key colors as RGB. Robust where pixel
 * sampling fails (tiny red eyes vs a large blue skirt). Returns a partial map
 * of {hair,eyes,skin,top,bottom,accent} → [r,g,b]; missing/garbled keys omitted.
 */
export async function extractColorsVLM(image, hfToken, opts = {}) {
  const text = await visionRead(image, hfToken, COLOR_INSTRUCTION, opts);
  const jsonStr = (text.match(/\{[\s\S]*\}/) || [text])[0];
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch { return {}; }
  const out = {};
  for (const k of ["hair", "eyes", "skin", "top", "bottom", "accent"]) {
    const rgb = hexToRgb(parsed[k]);
    if (rgb) out[k] = rgb;
  }
  if (typeof parsed.archetype === "string" && ARCHETYPES.includes(parsed.archetype.toLowerCase())) {
    out.archetype = parsed.archetype.toLowerCase();
  }
  return out;
}

const INSTRUCTION =
  "Describe this anime character concisely for making a Minecraft skin: " +
  "hair color and style, eye color, top, bottom, shoes, hat or accessories, " +
  "and the main colors. One short sentence, visual attributes only, no preamble.";

/**
 * @param {Uint8Array} image
 * @param {string} hfToken
 * @param {{ mime?: string, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<string>} a one-line character description
 */
/** Core HF-router vision call: image + instruction → model text. */
export async function visionRead(image, hfToken, instruction, opts = {}) {
  const mime = opts.mime ?? "image/png";
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30000;
  const dataUrl = `data:${mime};base64,${Buffer.from(image).toString("base64")}`;
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: "user", content: [{ type: "text", text: instruction }, { type: "image_url", image_url: { url: dataUrl } }] },
    ],
    max_tokens: opts.maxTokens ?? 220,
  });

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
        body,
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HF vision ${res.status}: ${(await res.text()).slice(0, 180)}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("HF vision returned no text");
      return text;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("HF vision failed");
}

export function captionImage(image, hfToken, opts = {}) {
  return visionRead(image, hfToken, INSTRUCTION, opts);
}
