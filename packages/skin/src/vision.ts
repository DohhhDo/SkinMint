/** Reads an image and answers a free-form instruction (caption, palette, spec…). */
export interface VisionProvider {
  readonly name: string;
  read(image: Uint8Array, instruction: string, mime?: string): Promise<string>;
}

export interface HFVisionConfig {
  /** A vision-language model on the HF router. Default: Qwen3-VL-8B. */
  model?: string;
  hfToken: string;
  endpoint?: string;
  retries?: number;
  /** Per-attempt timeout (ms) so a hung router call fails fast. Default: 30000. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

// HF retired api-inference.huggingface.co; serverless inference now routes
// through the OpenAI-compatible router. A vision-chat model reads images well.
const DEFAULT_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "Qwen/Qwen3-VL-8B-Instruct";

/** Vision-language reading via the Hugging Face router (no GPU; free HF token). */
export class HFVisionProvider implements VisionProvider {
  readonly name = "hf-vision";
  private readonly endpoint: string;
  private readonly model: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HFVisionConfig) {
    if (!config.hfToken) throw new Error("HFVisionProvider requires an hfToken");
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.model = config.model ?? DEFAULT_MODEL;
    this.retries = config.retries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.token = config.hfToken;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  async read(image: Uint8Array, instruction: string, mime = "image/png"): Promise<string> {
    const dataUrl = `data:${mime};base64,${Buffer.from(image).toString("base64")}`;
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "user", content: [{ type: "text", text: instruction }, { type: "image_url", image_url: { url: dataUrl } }] },
      ],
      max_tokens: 220,
    });
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
          body,
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`HF vision ${res.status}: ${(await res.text()).slice(0, 180)}`);
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim();
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
}

const MOCK_PALETTES = [
  '{"hair":"#3a2a22","skin":"#e8b98c","eyes":"#5a3a2a","top":"#3b6fb8","bottom":"#2b3a67","shoes":"#222"}',
  '{"hair":"#1a1a1e","skin":"#f0e0d0","eyes":"#cc2222","top":"#c83030","bottom":"#222","shoes":"#111"}',
  '{"hair":"#caa84a","skin":"#f5dcc0","eyes":"#3a7a5a","top":"#2f7a5b","bottom":"#3a3a44","shoes":"#2a2a2a"}',
];

/** Keyless placeholder — returns a deterministic palette JSON (varies by image). */
export class MockVisionProvider implements VisionProvider {
  readonly name = "mock-vision";
  async read(image: Uint8Array): Promise<string> {
    let h = 2166136261;
    for (let i = 0; i < Math.min(image.length, 64); i++) h = (h ^ image[i]!) * 16777619;
    return MOCK_PALETTES[(h >>> 0) % MOCK_PALETTES.length]!;
  }
}
