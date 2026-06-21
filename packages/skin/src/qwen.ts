import type { ImageProvider, ImageRequest, ImageResult } from "./image";

export interface QwenImageConfig {
  /** DashScope (or compatible gateway) API key. */
  apiKey: string;
  /** Multimodal-generation endpoint. Default: DashScope international. */
  endpoint?: string;
  /** text→image model. Default: qwen-image. */
  textModel?: string;
  /** image→image (edit) model. Default: qwen-image-edit. */
  editModel?: string;
  /** Output size, DashScope "W*H". Default: "1024*1024". */
  size?: string;
  fetch?: typeof fetch;
}

// International (Singapore) endpoint; Beijing is dashscope.aliyuncs.com. Keys are
// region-specific, so the endpoint is overridable via env.
const DEFAULT_ENDPOINT = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

/** Pull the first image URL out of DashScope's (somewhat variable) response shape. */
function findImageUrl(node: unknown): string | null {
  if (!node) return null;
  if (typeof node === "string") return /^https?:\/\//.test(node) ? node : null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const u = findImageUrl(v);
      if (u) return u;
    }
    return null;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.image === "string" && /^https?:\/\//.test(o.image)) return o.image;
    if (typeof o.url === "string" && /^https?:\/\//.test(o.url)) return o.url;
    for (const v of Object.values(o)) {
      const u = findImageUrl(v);
      if (u) return u;
    }
  }
  return null;
}

/**
 * Alibaba's Qwen image models on DashScope. text→image via `qwen-image`,
 * image→image via `qwen-image-edit`. Both on the sync multimodal-generation
 * endpoint. BYO-key.
 */
export class QwenImageProvider implements ImageProvider {
  readonly name = "qwen-image";
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly textModel: string;
  private readonly editModel: string;
  private readonly size: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: QwenImageConfig) {
    if (!config.apiKey) throw new Error("QwenImageProvider requires an apiKey");
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.textModel = config.textModel ?? "qwen-image";
    this.editModel = config.editModel ?? "qwen-image-edit";
    this.size = config.size ?? "1024*1024";
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  async generate(req: ImageRequest): Promise<ImageResult> {
    const content = req.image
      ? [{ image: `data:image/png;base64,${Buffer.from(req.image).toString("base64")}` }, { text: req.prompt }]
      : [{ text: req.prompt }];
    const model = req.image ? this.editModel : this.textModel;
    const size = req.size ?? this.size;
    const body = { model, input: { messages: [{ role: "user", content }] }, parameters: { n: 1, size } };

    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Qwen image ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const url = findImageUrl(await res.json());
    if (!url) throw new Error("Qwen returned no image URL");
    const img = await this.fetchImpl(url);
    if (!img.ok) throw new Error(`fetch Qwen image failed: ${img.status}`);
    const png = new Uint8Array(await img.arrayBuffer());
    const [w, h] = size.split("*").map(Number);
    return { png, width: w || 1024, height: h || 1024 };
  }
}
