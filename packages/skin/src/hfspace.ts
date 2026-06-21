import type { SkinOptions, SkinProvider, SkinResult } from "./types";

export interface HFSpaceSkinConfig {
  /** Gradio Space base URL. Default: the public Nick088 minecraft-skin Space. */
  space?: string;
  /** Underlying Stable Diffusion model. Default: "xl". */
  model?: "2" | "xl";
  /** Inference steps (1–50). Default: 25. */
  steps?: number;
  /** Guidance scale (0–10). Default: 7.5. */
  guidanceScale?: number;
  /** HF token — attributes ZeroGPU usage to your account (much higher quota). */
  hfToken?: string;
  /** Retry attempts on transient Space errors. Default: 3. */
  retries?: number;
  fetch?: typeof fetch;
}

const DEFAULT_SPACE = "https://nick088-minecraft-skin-generator.hf.space";

/**
 * Calls a public Hugging Face Space (Gradio) running the monadical minecraft
 * skin model. Free but unstable — fine for dev/prototyping. For production,
 * deploy the model (Modal/Replicate) behind the same SkinProvider interface.
 */
export class HFSpaceSkinProvider implements SkinProvider {
  readonly name = "hf-space";
  private readonly space: string;
  private readonly model: "2" | "xl";
  private readonly steps: number;
  private readonly guidance: number;
  private readonly retries: number;
  private readonly authHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HFSpaceSkinConfig = {}) {
    this.space = (config.space ?? DEFAULT_SPACE).replace(/\/$/, "");
    this.model = config.model ?? "xl";
    this.steps = config.steps ?? 25;
    this.guidance = config.guidanceScale ?? 7.5;
    this.retries = config.retries ?? 3;
    this.authHeaders = config.hfToken ? { Authorization: `Bearer ${config.hfToken}` } : {};
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  async generateSkin(prompt: string, options: SkinOptions = {}): Promise<SkinResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
      try {
        return await this.attempt(prompt, options);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("HF Space generation failed");
  }

  private async attempt(prompt: string, options: SkinOptions): Promise<SkinResult> {
    const seed = options.seed ?? Math.floor(Math.random() * 2_000_000_000);
    // /predict params: [prompt, model, steps, guidance, precision, seed, filename, model_3d, verbose]
    const data = [prompt, this.model, this.steps, this.guidance, "fp16", seed, "skin.png", false, false];

    const started = await this.fetchImpl(`${this.space}/gradio_api/call/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders },
      body: JSON.stringify({ data }),
    });
    if (!started.ok) throw new Error(`HF Space POST failed: ${started.status}`);
    const { event_id } = (await started.json()) as { event_id?: string };
    if (!event_id) throw new Error("HF Space returned no event_id");

    const stream = await this.fetchImpl(`${this.space}/gradio_api/call/predict/${event_id}`, {
      headers: this.authHeaders,
    });
    const text = await stream.text();

    if (/event:\s*error/.test(text)) {
      throw new Error("HF Space errored (likely ZeroGPU quota/busy — retry, add an HF token, or use a hosted backend)");
    }

    let result: unknown[] | null = null;
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const v = JSON.parse(line.slice(5).trim());
        if (Array.isArray(v) && v[0]) result = v;
      } catch {
        /* skip non-JSON event lines */
      }
    }
    if (!result) throw new Error("HF Space returned no image");

    const img = result[0] as { url?: string; path?: string };
    let url = img.url ?? img.path ?? "";
    if (url && !url.startsWith("http")) url = `${this.space}/gradio_api/file=${url}`;
    if (!url) throw new Error("HF Space image had no url/path");

    const res = await this.fetchImpl(url, { headers: this.authHeaders });
    if (!res.ok) throw new Error(`fetch skin image failed: ${res.status}`);
    const png = new Uint8Array(await res.arrayBuffer());
    return { png, width: 64, height: 64 };
  }
}
