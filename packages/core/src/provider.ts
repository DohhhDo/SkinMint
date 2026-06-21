import type {
  GenerateOptions,
  GenerationTask,
  PollOptions,
  Provider,
  TaskStatus,
} from "./types";

const TERMINAL: TaskStatus[] = ["succeeded", "failed"];

export class GenerationTimeoutError extends Error {
  constructor(public readonly taskId: string, timeoutMs: number) {
    super(`Generation task ${taskId} did not finish within ${timeoutMs}ms`);
    this.name = "GenerationTimeoutError";
  }
}

export class GenerationFailedError extends Error {
  constructor(public readonly task: GenerationTask) {
    super(task.error ?? `Generation task ${task.id} failed`);
    this.name = "GenerationFailedError";
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("Aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new Error("Aborted"));
      },
      { once: true },
    );
  });
}

/**
 * Base class that implements the create→poll loop on top of a provider's
 * `create()` / `get()` primitives. Concrete providers only implement those two.
 */
export abstract class BaseProvider implements Provider {
  abstract readonly name: string;
  abstract create(options: GenerateOptions): Promise<{ taskId: string }>;
  abstract get(taskId: string): Promise<GenerationTask>;

  /** Poll an existing task until it reaches a terminal state. */
  async poll(taskId: string, options: PollOptions = {}): Promise<GenerationTask> {
    const { intervalMs = 4000, timeoutMs = 300_000, onProgress, signal } = options;
    const deadline = Date.now() + timeoutMs;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const task = await this.get(taskId);
      onProgress?.(task);

      if (TERMINAL.includes(task.status)) {
        if (task.status === "failed") throw new GenerationFailedError(task);
        return task;
      }
      if (Date.now() >= deadline) throw new GenerationTimeoutError(taskId, timeoutMs);
      await delay(intervalMs, signal);
    }
  }

  async generate(
    options: GenerateOptions,
    poll: PollOptions = {},
  ): Promise<GenerationTask> {
    const { taskId } = await this.create(options);
    return this.poll(taskId, poll);
  }
}
