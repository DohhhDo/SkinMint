// The generated 立绘 style is locked in code — standard anime / 二次元, always
// front-facing full-body on a plain background so the downstream reader gets a
// consistent, canonical input. Users cannot change the art style.

export const ANIME_POSITIVE =
  "masterpiece, best quality, anime illustration, clean lineart, cel shading, vibrant colors, " +
  "full body, front view, standing, plain white background, single character, centered, character reference";

export const ANIME_NEGATIVE =
  "realistic, photorealistic, photo, 3d, cgi, multiple characters, extra limbs, text, watermark, " +
  "signature, busy background, scenery, cropped, close-up, nsfw";

/** Wrap a user subject in the locked anime style. */
export function animePrompt(subject: string): string {
  const s = subject.trim().replace(/\s+/g, " ");
  return `${ANIME_POSITIVE}, ${s}`;
}
