/** Normalized status across providers. */
export type TaskStatus = "pending" | "running" | "succeeded" | "failed";

/** Downloadable model URLs returned by a provider. */
export interface ModelUrls {
  glb?: string;
  fbx?: string;
  obj?: string;
  usdz?: string;
  stl?: string;
}

/** A normalized generation task, provider-agnostic. */
export interface GenerationTask {
  /** Provider-side task id. */
  id: string;
  status: TaskStatus;
  /** 0–100. */
  progress: number;
  modelUrls?: ModelUrls;
  thumbnailUrl?: string;
  /** Present when status === "failed". */
  error?: string;
  /** The raw provider payload, for debugging / provider-specific needs. */
  raw?: unknown;
}

/** Options for a text-to-3D generation request. */
export interface GenerateOptions {
  prompt: string;
  /** Free-form style hint, e.g. "realistic", "sculpture", "cartoon". */
  artStyle?: string;
  /** Things to avoid in the result. */
  negativePrompt?: string;
  /** Reduce geometry density (maps to provider low-poly / target polycount). */
  targetPolycount?: number;
  /** Preferred mesh topology. */
  topology?: "triangle" | "quad";
  /** Deterministic seed, when the provider supports it. */
  seed?: number;
  /**
   * Run a refine/texture pass after the preview mesh (higher quality, more
   * credits, slower). Provider-dependent. Default: false.
   */
  refine?: boolean;
  /** Geometry style. Meshy: "lowpoly" yields low-poly meshes. */
  modelType?: "standard" | "lowpoly";
  /** Clean rigging pose (Meshy `pose_mode`). */
  poseMode?: "a-pose" | "t-pose" | "";
  /** Force remesh so `topology` / `targetPolycount` take effect. */
  shouldRemesh?: boolean;
  /** Provider model version (Meshy: "meshy-5" | "meshy-6" | "latest"). */
  aiModel?: string;
  /** Escape hatch for provider-specific fields. */
  extra?: Record<string, unknown>;
}

/** Options controlling the create→poll loop. */
export interface PollOptions {
  /** Milliseconds between status checks. Default: 4000. */
  intervalMs?: number;
  /** Give up after this many milliseconds. Default: 300000 (5 min). */
  timeoutMs?: number;
  /** Called on every status check with the latest task. */
  onProgress?: (task: GenerationTask) => void;
  /** Abort the poll loop early. */
  signal?: AbortSignal;
}

/** A text-to-3D generation provider. */
export interface Provider {
  readonly name: string;
  /** Submit a generation task; returns its id. */
  create(options: GenerateOptions): Promise<{ taskId: string }>;
  /** Fetch the current state of a task. */
  get(taskId: string): Promise<GenerationTask>;
  /** Create, then poll until the task reaches a terminal state. */
  generate(options: GenerateOptions, poll?: PollOptions): Promise<GenerationTask>;
  /**
   * Optional: start a refine/texture pass on a finished task (adds color/PBR
   * materials). Returns the new task id. Providers without a refine stage omit
   * this.
   */
  refine?(taskId: string, options?: GenerateOptions): Promise<{ taskId: string }>;
}
