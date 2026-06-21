import { useCallback, useRef, useState } from "react";

export type GenerationPhase =
  | "idle"
  | "starting"
  | "running"
  | "succeeded"
  | "failed";

export interface GenerateInput {
  prompt: string;
  targetPolycount?: number;
  topology?: "triangle" | "quad";
  modelType?: "standard" | "lowpoly";
  poseMode?: "a-pose" | "t-pose" | "";
  shouldRemesh?: boolean;
  aiModel?: string;
  seed?: number;
  refine?: boolean;
  extra?: Record<string, unknown>;
}

export interface UseTextTo3DOptions {
  /** URL of your generation endpoint (e.g. "/api/generate"). */
  endpoint: string;
  /** Status poll interval in ms. Default: 3000. */
  pollIntervalMs?: number;
  /** Give up after this many ms. Default: 300000 (5 min). */
  timeoutMs?: number;
  /** Extra headers to send (e.g. a BYO API key). Evaluated per request. */
  headers?: () => Record<string, string>;
}

export interface UseTextTo3DResult {
  /** Start a generation. Resolves with the model URL on success. */
  generate: (input: GenerateInput) => Promise<string | undefined>;
  /** Cancel any in-flight generation and clear state. */
  reset: () => void;
  phase: GenerationPhase;
  /** 0–100. */
  progress: number;
  modelUrl?: string;
  /** Provider preview image, available before the model finishes optimizing. */
  thumbnailUrl?: string;
  /** True once the provider finished but the model is still being optimized/stored. */
  finalizing: boolean;
  taskId?: string;
  error?: string;
  isLoading: boolean;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * React hook that drives a SkinMint generation endpoint: POST the prompt, then poll
 * status until the model is ready. Pair the returned `modelUrl` with
 * `<GeneratedModelViewer />`.
 */
export function useTextTo3D(options: UseTextTo3DOptions): UseTextTo3DResult {
  const { endpoint, pollIntervalMs = 3000, timeoutMs = 300_000, headers } = options;

  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string>();
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [finalizing, setFinalizing] = useState(false);
  const [taskId, setTaskId] = useState<string>();
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setProgress(0);
    setModelUrl(undefined);
    setThumbnailUrl(undefined);
    setFinalizing(false);
    setTaskId(undefined);
    setError(undefined);
  }, []);

  const generate = useCallback(
    async (input: GenerateInput): Promise<string | undefined> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setPhase("starting");
      setProgress(0);
      setModelUrl(undefined);
      setThumbnailUrl(undefined);
      setFinalizing(false);
      setTaskId(undefined);
      setError(undefined);

      try {
        const extraHeaders = headers?.() ?? {};
        const startRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...extraHeaders },
          body: JSON.stringify(input),
          signal: ac.signal,
        });
        const startBody = await startRes.json();
        if (!startRes.ok) throw new Error(startBody.error ?? `HTTP ${startRes.status}`);

        const id: string = startBody.taskId;
        setTaskId(id);
        setPhase("running");

        const deadline = Date.now() + timeoutMs;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const statusRes = await fetch(
            `${endpoint}?taskId=${encodeURIComponent(id)}`,
            { signal: ac.signal, headers: extraHeaders },
          );
          const status = await statusRes.json();
          if (!statusRes.ok) throw new Error(status.error ?? `HTTP ${statusRes.status}`);

          setProgress(status.progress ?? 0);
          if (status.thumbnailUrl) setThumbnailUrl(status.thumbnailUrl);
          setFinalizing(Boolean(status.finalizing));

          if (status.status === "succeeded") {
            setModelUrl(status.modelUrl);
            setFinalizing(false);
            setPhase("succeeded");
            return status.modelUrl as string | undefined;
          }
          if (status.status === "failed") {
            throw new Error(status.error ?? "generation failed");
          }
          if (Date.now() > deadline) throw new Error("generation timed out");

          await sleep(pollIntervalMs, ac.signal);
        }
      } catch (err) {
        if (ac.signal.aborted) return undefined;
        setError(err instanceof Error ? err.message : String(err));
        setPhase("failed");
        return undefined;
      }
    },
    [endpoint, pollIntervalMs, timeoutMs],
  );

  return {
    generate,
    reset,
    phase,
    progress,
    modelUrl,
    thumbnailUrl,
    finalizing,
    taskId,
    error,
    isLoading: phase === "starting" || phase === "running",
  };
}
