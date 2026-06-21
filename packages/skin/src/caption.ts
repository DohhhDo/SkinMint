import { HFVisionProvider } from "./vision";

/** Turns an image into a short text description — used to caption a 立绘. */
export interface ImageCaptioner {
  readonly name: string;
  caption(image: Uint8Array, mime?: string): Promise<string>;
}

export interface HFCaptionConfig {
  /** A vision-language model on the HF router. Default: Qwen3-VL-8B. */
  model?: string;
  hfToken?: string;
  endpoint?: string;
  instruction?: string;
  retries?: number;
  fetch?: typeof fetch;
}

const DEFAULT_INSTRUCTION =
  "Describe this character concisely for a Minecraft skin: hair color and style, top, bottom, hat or accessories, and the main colors. One short sentence, visual attributes only, no preamble.";

/**
 * Captions an image via a vision-language model on the HF router — a thin,
 * fixed-instruction wrapper over {@link HFVisionProvider}. Kept for the
 * caption→skin fallback path.
 */
export class HFCaptionProvider implements ImageCaptioner {
  readonly name = "hf-caption";
  private readonly vision: HFVisionProvider;
  private readonly instruction: string;

  constructor(config: HFCaptionConfig = {}) {
    if (!config.hfToken) throw new Error("HFCaptionProvider requires an hfToken");
    this.instruction = config.instruction ?? DEFAULT_INSTRUCTION;
    this.vision = new HFVisionProvider({
      hfToken: config.hfToken,
      model: config.model,
      endpoint: config.endpoint,
      retries: config.retries,
      fetch: config.fetch,
    });
  }

  caption(image: Uint8Array, mime = "image/png"): Promise<string> {
    return this.vision.read(image, this.instruction, mime);
  }
}

/** Compose a clean Minecraft-skin prompt from a free-form image caption. */
export function captionToSkinPrompt(caption: string): string {
  const cleaned = caption
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\b(image|picture|photo|illustration|drawing|render|of|that|which)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `minecraft skin of a character, ${cleaned}, full body, front and back view`;
}
