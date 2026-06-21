import type { SkinOptions, SkinProvider, SkinResult } from "./types";

export interface ModalSkinConfig {
  /** Your deployed Modal web endpoint URL (POST → image/png). */
  endpoint: string;
  /** Bearer token matching the Modal secret (SKINMINT_SKIN_TOKEN). */
  token?: string;
  /** Inference steps. Default: 25. */
  steps?: number;
  fetch?: typeof fetch;
}

/**
 * Calls your own Modal deployment of the minecraft-skin SDXL model
 * (see infra/modal/skin.py). Stable + scale-to-zero. Returns a 64×64 PNG.
 */
export class ModalSkinProvider implements SkinProvider {
  readonly name = "modal";
  private readonly endpoint: string;
  private readonly token?: string;
  private readonly steps: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ModalSkinConfig) {
    if (!config.endpoint) throw new Error("ModalSkinProvider requires an endpoint");
    this.endpoint = config.endpoint;
    this.token = config.token;
    this.steps = config.steps ?? 25;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  async generateSkin(prompt: string, options: SkinOptions = {}): Promise<SkinResult> {
    const image = options.image
      ? Buffer.from(options.image).toString("base64")
      : undefined;
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        steps: this.steps,
        seed: options.seed ?? 0,
        token: this.token,
        // img2img: when an init image is supplied, the endpoint conditions on it
        image,
        strength: options.strength ?? 0.65,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Modal skin endpoint ${res.status}: ${body.slice(0, 200)}`);
    }
    const png = new Uint8Array(await res.arrayBuffer());
    return { png, width: 64, height: 64 };
  }
}
