import { BaseProvider } from "../provider";
import type { GenerateOptions, GenerationTask } from "../types";

export interface MockProviderConfig {
  /** GLB URL returned when a (preview) task "succeeds". */
  glbUrl?: string;
  /** GLB URL returned for a refined task. Defaults to `glbUrl`. */
  refinedGlbUrl?: string;
  thumbnailUrl?: string;
  /** Number of polls before the task succeeds. Default: 2. */
  stepsToComplete?: number;
}

const DEFAULT_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb";

interface MockState {
  prompt: string;
  polls: number;
  glb: string;
}

/**
 * Offline provider that simulates the async generation lifecycle without any
 * API key — useful for wiring up the server/demo and for tests. Progress is
 * driven by the number of `get()` calls, so it's deterministic (no timers).
 */
export class MockProvider extends BaseProvider {
  readonly name = "mock";
  private readonly glbUrl: string;
  private readonly refinedGlbUrl: string;
  private readonly thumbnailUrl?: string;
  private readonly steps: number;
  private readonly tasks = new Map<string, MockState>();
  private counter = 0;

  constructor(config: MockProviderConfig = {}) {
    super();
    this.glbUrl = config.glbUrl ?? DEFAULT_GLB;
    this.refinedGlbUrl = config.refinedGlbUrl ?? this.glbUrl;
    this.thumbnailUrl = config.thumbnailUrl;
    this.steps = Math.max(1, config.stepsToComplete ?? 2);
  }

  async create(options: GenerateOptions): Promise<{ taskId: string }> {
    const taskId = `mock-${++this.counter}`;
    this.tasks.set(taskId, { prompt: options.prompt, polls: 0, glb: this.glbUrl });
    return { taskId };
  }

  async refine(previewTaskId: string): Promise<{ taskId: string }> {
    const preview = this.tasks.get(previewTaskId);
    const taskId = `mock-${++this.counter}`;
    this.tasks.set(taskId, {
      prompt: preview?.prompt ?? "",
      polls: 0,
      glb: this.refinedGlbUrl,
    });
    return { taskId };
  }

  async get(taskId: string): Promise<GenerationTask> {
    const state = this.tasks.get(taskId);
    if (!state) throw new Error(`Unknown mock task: ${taskId}`);

    state.polls += 1;
    const done = state.polls >= this.steps;
    const progress = Math.min(100, Math.round((state.polls / this.steps) * 100));

    return {
      id: taskId,
      status: done ? "succeeded" : "running",
      progress,
      modelUrls: done ? { glb: state.glb } : undefined,
      thumbnailUrl: done ? this.thumbnailUrl : undefined,
      raw: { ...state },
    };
  }
}
