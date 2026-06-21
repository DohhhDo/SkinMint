import type { GenerateOptions, Provider } from "@skinmint/core";
import { optimizeGlb, type OptimizeOptions } from "@skinmint/core";
import type { BlobStorage, GenerationRecord, GenerationStore } from "@skinmint/store";

export interface GenerationHandlerOptions {
  /** The text-to-3D provider (holds your API key). Built server-side only. */
  provider: Provider;
  /**
   * Optimize the GLB before serving/storing. `true` uses sensible defaults.
   * Without `storage`, models are optimized on read and cached in memory.
   */
  optimize?: boolean | OptimizeOptions;
  /**
   * Persist optimized models. Local storages are served same-origin via this
   * handler; cloud storages (S3/R2) expose their own public URLs.
   */
  storage?: BlobStorage;
  /** Persist generation records for history / gallery. */
  store?: GenerationStore;
  /** Reject prompts longer than this. */
  maxPromptLength?: number;
  /** Value for Access-Control-Allow-Origin. Omit to disable CORS headers. */
  cors?: string;
}

/** A Web-standard request handler (Next.js App Router, Bun, Workers, …). */
export type WebHandler = (request: Request) => Promise<Response>;

export interface GenerationStatusResponse {
  taskId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  progress: number;
  /** Present when the model is ready and (if applicable) persisted. */
  modelUrl?: string;
  thumbnailUrl?: string;
  /** True while the model is being optimized/stored after the provider finished. */
  finalizing?: boolean;
  error?: string;
}

export function createGenerationHandler(
  options: GenerationHandlerOptions,
): WebHandler {
  const { provider, storage, store } = options;
  const optimizeOpts: OptimizeOptions | null =
    options.optimize === true ? {} : options.optimize || null;

  const memoryCache = new Map<string, Uint8Array>(); // optimize-on-read (no storage)
  const inFlight = new Set<string>(); // persist jobs in progress
  // Tracks refine intent + the refine task id for a given (preview) task id.
  // In-memory: refine chaining needs a long-lived process (next dev / a node
  // server), not per-request serverless.
  const jobs = new Map<string, { refine: boolean; refineTaskId?: string }>();

  /** The task whose GLB we ultimately serve (refine task when refining). */
  function finalSourceId(taskId: string): string {
    return jobs.get(taskId)?.refineTaskId ?? taskId;
  }

  /** Fetch the provider's GLB and optimize it (or pass through). */
  async function fetchModel(glbUrl: string): Promise<Uint8Array> {
    const res = await fetch(glbUrl);
    if (!res.ok) throw new Error(`failed to fetch model: ${res.status}`);
    const input = new Uint8Array(await res.arrayBuffer());
    if (!optimizeOpts) return input;
    const { data } = await optimizeGlb(input, optimizeOpts);
    return data;
  }

  /** Optimize-on-read path (no storage): cache by task id. */
  async function getOptimized(taskId: string): Promise<Uint8Array | null> {
    const cached = memoryCache.get(taskId);
    if (cached) return cached;
    const task = await provider.get(finalSourceId(taskId));
    const glb = task.modelUrls?.glb;
    if (task.status !== "succeeded" || !glb) return null;
    const data = await fetchModel(glb);
    memoryCache.set(taskId, data);
    return data;
  }

  /**
   * Persist a finished model to storage + store. Idempotent, runs async.
   * `recordId` keys the stored file/record; `sourceTaskId` is the task whose
   * GLB is fetched (the refine task when refining).
   */
  async function persist(
    recordId: string,
    sourceTaskId: string,
    pathname: string,
  ): Promise<void> {
    if (!storage || inFlight.has(recordId)) return;
    inFlight.add(recordId);
    try {
      const task = await provider.get(sourceTaskId);
      const glb = task.modelUrls?.glb;
      if (task.status !== "succeeded" || !glb) return;

      const key = `${recordId}.glb`;
      const data = await fetchModel(glb);
      await storage.put(key, data, "model/gltf-binary");
      const modelUrl = storage.isPublic
        ? storage.url(key)
        : `${pathname}?file=${encodeURIComponent(key)}`;
      await store?.update(recordId, {
        status: "succeeded",
        modelUrl,
        thumbnailUrl: task.thumbnailUrl,
      });
    } catch (err) {
      await store?.update(recordId, {
        status: "failed",
        error: err instanceof Error ? err.message : "persist failed",
      });
    } finally {
      inFlight.delete(recordId);
    }
  }

  function toStatusResponse(record: GenerationRecord): GenerationStatusResponse {
    return {
      taskId: record.id,
      status: record.status,
      progress: record.status === "succeeded" ? 100 : 0,
      modelUrl: record.modelUrl,
      thumbnailUrl: record.thumbnailUrl,
      error: record.error,
    };
  }

  return async (request) => {
    const cors = corsHeaders(options.cors);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const prompt = String(body.prompt ?? "").trim();
        if (!prompt) return json({ error: "prompt is required" }, 400, cors);
        if (options.maxPromptLength && prompt.length > options.maxPromptLength) {
          return json({ error: "prompt too long" }, 400, cors);
        }

        const genOptions: GenerateOptions = {
          prompt,
          targetPolycount: body.targetPolycount as number | undefined,
          topology: body.topology as GenerateOptions["topology"],
          modelType: body.modelType as GenerateOptions["modelType"],
          poseMode: body.poseMode as GenerateOptions["poseMode"],
          shouldRemesh: body.shouldRemesh as boolean | undefined,
          aiModel: body.aiModel as string | undefined,
          seed: body.seed as number | undefined,
          refine: body.refine as boolean | undefined,
          extra: body.extra as Record<string, unknown> | undefined,
        };
        const { taskId } = await provider.create(genOptions);
        const refine = Boolean(genOptions.refine) && Boolean(provider.refine);
        jobs.set(taskId, { refine });
        await store?.create({ id: taskId, prompt, status: "running", refine });
        return json({ taskId }, 200, cors);
      }

      if (request.method === "GET") {
        const url = new URL(request.url);

        // Serve a stored blob (local storages only).
        const fileKey = url.searchParams.get("file");
        if (fileKey) {
          if (!storage || storage.isPublic) return json({ error: "not found" }, 404, cors);
          const blob = await storage.get(fileKey);
          if (!blob) return json({ error: "not found" }, 404, cors);
          return new Response(blob.data as unknown as BodyInit, {
            status: 200,
            headers: {
              ...cors,
              // Models are meant to be embedded cross-origin (e.g. a <skinmint-model>
              // on someone's own site), so always allow any origin to fetch them.
              "Access-Control-Allow-Origin": "*",
              "Content-Type": blob.contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }

        // Gallery / history listing.
        if (url.searchParams.has("list")) {
          const limit = Number(url.searchParams.get("limit")) || 50;
          const generations = store ? await store.list(limit) : [];
          return json({ generations }, 200, cors);
        }

        // Optimize-on-read download (only when no persistent storage).
        if (url.searchParams.get("download") === "glb") {
          const taskId = url.searchParams.get("taskId");
          if (!taskId) return json({ error: "taskId is required" }, 400, cors);
          const bytes = await getOptimized(taskId);
          if (!bytes) return json({ error: "model not ready" }, 409, cors);
          return new Response(bytes as unknown as BodyInit, {
            status: 200,
            headers: {
              ...cors,
              "Content-Type": "model/gltf-binary",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }

        // Status.
        const taskId = url.searchParams.get("taskId");
        if (!taskId) return json({ error: "taskId is required" }, 400, cors);

        // Read the durable record (source of truth for refine state across
        // polls — survives serverless / dev-server module reloads).
        const record = store ? await store.get(taskId) : undefined;
        if (record?.status === "succeeded" && record.modelUrl) {
          return json(toStatusResponse(record), 200, cors);
        }

        const memJob = jobs.get(taskId);
        const job = {
          refine: record?.refine ?? memJob?.refine ?? false,
          refineTaskId: record?.refineTaskId ?? memJob?.refineTaskId,
        };
        const preview = await provider.get(taskId);

        const fail = (error?: string) => {
          void store?.update(taskId, { status: "failed", error });
          return json(
            { taskId, status: "failed", progress: 0, error } satisfies GenerationStatusResponse,
            200,
            cors,
          );
        };

        if (preview.status === "failed") return fail(preview.error);

        // Preview still generating. When refining, this is only the first half.
        if (preview.status !== "succeeded") {
          return json(
            {
              taskId,
              status: preview.status,
              progress: job.refine ? Math.round(preview.progress / 2) : preview.progress,
              thumbnailUrl: preview.thumbnailUrl,
            } satisfies GenerationStatusResponse,
            200,
            cors,
          );
        }

        // Preview done. Determine the final task (refine pass adds color).
        let finalTask = preview;
        let finalId = taskId;
        if (job.refine && provider.refine) {
          if (!job.refineTaskId) {
            const { taskId: refineId } = await provider.refine(taskId);
            job.refineTaskId = refineId;
            jobs.set(taskId, { refine: true, refineTaskId: refineId });
            await store?.update(taskId, { refineTaskId: refineId });
          }
          finalId = job.refineTaskId;
          finalTask = await provider.get(finalId);

          if (finalTask.status === "failed") return fail(finalTask.error);
          if (finalTask.status !== "succeeded") {
            return json(
              {
                taskId,
                status: "running",
                progress: Math.round(50 + finalTask.progress / 2),
                thumbnailUrl: preview.thumbnailUrl ?? finalTask.thumbnailUrl,
              } satisfies GenerationStatusResponse,
              200,
              cors,
            );
          }
        }

        const thumbnailUrl = finalTask.thumbnailUrl ?? preview.thumbnailUrl;

        if (storage) {
          // Final model ready; optimize + store in the background.
          void persist(taskId, finalId, url.pathname);
          return json(
            { taskId, status: "running", progress: 100, thumbnailUrl, finalizing: true } satisfies GenerationStatusResponse,
            200,
            cors,
          );
        }

        const rawGlb = finalTask.modelUrls?.glb;
        const modelUrl =
          rawGlb &&
          (optimizeOpts
            ? `${url.pathname}?taskId=${encodeURIComponent(taskId)}&download=glb`
            : rawGlb);
        // Pre-warm the optimize-on-read cache so the first viewer load is fast.
        if (optimizeOpts) void getOptimized(taskId).catch(() => {});
        return json(
          {
            taskId,
            status: "succeeded",
            progress: 100,
            modelUrl: modelUrl || undefined,
            thumbnailUrl,
          } satisfies GenerationStatusResponse,
          200,
          cors,
        );
      }

      return json({ error: "method not allowed" }, 405, cors);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      return json({ error: message }, 500, cors);
    }
  };
}

function corsHeaders(origin?: string): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
