import {
  QwenImageProvider,
  GeminiImageProvider,
  MockImageProvider,
  HFVisionProvider,
  MockVisionProvider,
  type ImageProvider,
  type VisionProvider,
} from "@skinmint/skin";

// Resolve the AI backends from env — BYO-key, swappable, with a keyless Mock
// fallback so the project runs for anyone who clones it. Override the auto
// choice with SKINMINT_IMAGE_PROVIDER / SKINMINT_VISION_PROVIDER.

/** Image generation/editing: text→立绘 and 立绘→standardized立绘. Default: Qwen-Image. */
export function resolveImageProvider(): ImageProvider {
  const pref = (process.env.SKINMINT_IMAGE_PROVIDER || "").toLowerCase();
  const qwen = process.env.DASHSCOPE_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  const mkQwen = () => new QwenImageProvider({ apiKey: qwen!, endpoint: process.env.DASHSCOPE_ENDPOINT });
  const mkGemini = () => new GeminiImageProvider({ apiKey: gemini!, model: process.env.GEMINI_MODEL });

  if (pref === "mock") return new MockImageProvider();
  if (pref === "qwen" && qwen) return mkQwen();
  if (pref === "gemini" && gemini) return mkGemini();
  // auto: Qwen (default) → Gemini → Mock
  if (qwen) return mkQwen();
  if (gemini) return mkGemini();
  return new MockImageProvider();
}

/** Vision reading: 立绘 → structured info (palette / spec). Default: HF router. */
export function resolveVisionProvider(): VisionProvider {
  const pref = (process.env.SKINMINT_VISION_PROVIDER || "").toLowerCase();
  if (pref === "mock") return new MockVisionProvider();
  if (process.env.HF_TOKEN) return new HFVisionProvider({ hfToken: process.env.HF_TOKEN, model: process.env.SKINMINT_VISION_MODEL });
  return new MockVisionProvider();
}

/** Whether a real (non-mock) image generator is configured. */
export const hasImageProvider = () => !!(process.env.DASHSCOPE_API_KEY || process.env.GEMINI_API_KEY);
