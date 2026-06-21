// Prompt construction for 立绘 → Minecraft skin (img2img).
// The init image IS the 立绘, so the prompt's job is to (a) force the
// minecraft-skin atlas domain and (b) carry over the character's visual
// attributes (from a caption) without fighting the init image.

const SKIN_POSITIVE =
  "minecraft skin, full body character reference, front and back view, " +
  "flat cel shading, clean blocky pixel art, vibrant colors";

const SKIN_NEGATIVE =
  "realistic, photo, 3d render, blurry, multiple characters, text, watermark, " +
  "busy background, scenery, nsfw";

/** Build the final positive prompt from an optional character caption. */
export function skinPrompt(caption) {
  const c = (caption ?? "").replace(/\s+/g, " ").trim();
  return c ? `${SKIN_POSITIVE}, ${c}` : `${SKIN_POSITIVE}, anime character`;
}

export const NEGATIVE_PROMPT = SKIN_NEGATIVE;
