import type { ImageProvider, ImageRequest, ImageResult } from "./image";

export interface GeminiImageConfig {
  /** Google AI Studio / Gemini API key. */
  apiKey: string;
  /** Model id. Default: gemini-2.5-flash-image (Nano Banana). */
  model?: string;
  /** Override the base endpoint. */
  endpoint?: string;
  fetch?: typeof fetch;
}

const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

/**
 * Google's Gemini 2.5 Flash Image ("Nano Banana"). text→image, and image→image
 * editing when an init image is supplied. Free tier ~500/day; BYO-key.
 */
export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini-image";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GeminiImageConfig) {
    if (!config.apiKey) throw new Error("GeminiImageProvider requires an apiKey");
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  async generate(req: ImageRequest): Promise<ImageResult> {
    const url = `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`;
    const parts: unknown[] = [{ text: req.prompt }];
    if (req.image) parts.push({ inline_data: { mime_type: req.mime ?? "image/png", data: Buffer.from(req.image).toString("base64") } });
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    });
    if (!res.ok) throw new Error(`Gemini image ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    const ps: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const img = ps.map((p) => p?.inlineData ?? p?.inline_data).find((d) => d?.data);
    if (!img?.data) throw new Error("Gemini returned no image");
    return { png: new Uint8Array(Buffer.from(img.data, "base64")), width: 1024, height: 1024 };
  }
}
