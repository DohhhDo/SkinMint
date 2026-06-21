import { BaseProvider } from "../provider";
import type {
  GenerateOptions,
  GenerationTask,
  PollOptions,
  TaskStatus,
} from "../types";

export interface MeshyProviderConfig {
  apiKey: string;
  /** Override the API base URL. Default: https://api.meshy.ai */
  baseUrl?: string;
  /** Inject a custom fetch (tests, proxies). Default: global fetch. */
  fetch?: typeof fetch;
}

/** Shape of Meshy's v2 text-to-3d task payload (subset we use). */
interface MeshyTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress?: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  thumbnail_url?: string;
  task_error?: { message?: string };
}

const STATUS_MAP: Record<MeshyTask["status"], TaskStatus> = {
  PENDING: "pending",
  IN_PROGRESS: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "failed",
};

/**
 * Meshy text-to-3D provider.
 * @see https://docs.meshy.ai/api/text-to-3d
 */
export class MeshyProvider extends BaseProvider {
  readonly name = "meshy";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MeshyProviderConfig) {
    super();
    if (!config.apiKey) throw new Error("MeshyProvider requires an apiKey");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.meshy.ai").replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Meshy API ${res.status} ${res.statusText}: ${body}`);
    }
    return (await res.json()) as T;
  }

  /** Submit the initial preview mesh task. */
  async create(options: GenerateOptions): Promise<{ taskId: string }> {
    // Note: art_style is deprecated and negative_prompt is ignored by Meshy —
    // style is controlled via the prompt text, model_type, and pose_mode.
    const body = prune({
      mode: "preview",
      prompt: options.prompt,
      ai_model: options.aiModel,
      model_type: options.modelType,
      pose_mode: options.poseMode || undefined,
      topology: options.topology,
      target_polycount: options.targetPolycount,
      should_remesh:
        options.shouldRemesh ?? (options.targetPolycount != null ? true : undefined),
      seed: options.seed,
      ...options.extra,
    });
    const { result } = await this.request<{ result: string }>(
      "/openapi/v2/text-to-3d",
      { method: "POST", body: JSON.stringify(body) },
    );
    return { taskId: result };
  }

  /** Submit a refine (texture) task for a finished preview. */
  async refine(
    previewTaskId: string,
    options: GenerateOptions = { prompt: "" },
  ): Promise<{ taskId: string }> {
    const body = prune({
      mode: "refine",
      preview_task_id: previewTaskId,
      texture_prompt: options.extra?.["texturePrompt"],
      enable_pbr: options.extra?.["enablePbr"] ?? true,
    });
    const { result } = await this.request<{ result: string }>(
      "/openapi/v2/text-to-3d",
      { method: "POST", body: JSON.stringify(body) },
    );
    return { taskId: result };
  }

  async get(taskId: string): Promise<GenerationTask> {
    const t = await this.request<MeshyTask>(`/openapi/v2/text-to-3d/${taskId}`);
    return normalize(t);
  }

  /** Preview, then optionally chain a refine pass. */
  override async generate(
    options: GenerateOptions,
    poll: PollOptions = {},
  ): Promise<GenerationTask> {
    const preview = await super.generate(options, poll);
    if (!options.refine || preview.status !== "succeeded") return preview;

    const { taskId } = await this.refine(preview.id, options);
    return this.poll(taskId, poll);
  }
}

function normalize(t: MeshyTask): GenerationTask {
  return {
    id: t.id,
    status: STATUS_MAP[t.status],
    progress: t.progress ?? 0,
    modelUrls: t.model_urls,
    thumbnailUrl: t.thumbnail_url,
    error: t.task_error?.message,
    raw: t,
  };
}

/** Drop undefined values so we don't send them to the API. */
function prune<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
