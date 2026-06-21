import { describe, it, expect, vi } from "vitest";
import { MeshyProvider, GenerationFailedError } from "../src/index";

function json(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("MeshyProvider", () => {
  it("creates a preview task and polls until it succeeds", async () => {
    let getCalls = 0;
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.mode).toBe("preview");
        expect(body.prompt).toBe("a duck");
        return json({ result: "preview-1" });
      }
      getCalls += 1;
      return getCalls < 2
        ? json({ id: "preview-1", status: "IN_PROGRESS", progress: 40 })
        : json({
            id: "preview-1",
            status: "SUCCEEDED",
            progress: 100,
            model_urls: { glb: "https://cdn/x.glb" },
            thumbnail_url: "https://cdn/x.png",
          });
    });

    const provider = new MeshyProvider({
      apiKey: "key",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const task = await provider.generate({ prompt: "a duck" }, { intervalMs: 1 });

    expect(task.status).toBe("succeeded");
    expect(task.modelUrls?.glb).toBe("https://cdn/x.glb");
    expect(task.thumbnailUrl).toBe("https://cdn/x.png");
    expect(getCalls).toBe(2);
  });

  it("chains a refine pass when refine: true", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.mode === "preview") return json({ result: "preview-1" });
        expect(body.mode).toBe("refine");
        expect(body.preview_task_id).toBe("preview-1");
        return json({ result: "refine-1" });
      }
      if (u.endsWith("/preview-1")) {
        return json({ id: "preview-1", status: "SUCCEEDED", progress: 100, model_urls: { glb: "p.glb" } });
      }
      return json({ id: "refine-1", status: "SUCCEEDED", progress: 100, model_urls: { glb: "r.glb" } });
    });

    const provider = new MeshyProvider({
      apiKey: "key",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const task = await provider.generate({ prompt: "x", refine: true }, { intervalMs: 1 });

    expect(task.id).toBe("refine-1");
    expect(task.modelUrls?.glb).toBe("r.glb");
  });

  it("throws GenerationFailedError on a failed task", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json({ result: "t1" });
      return json({ id: "t1", status: "FAILED", task_error: { message: "bad prompt" } });
    });
    const provider = new MeshyProvider({
      apiKey: "key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.generate({ prompt: "x" }, { intervalMs: 1 })).rejects.toBeInstanceOf(
      GenerationFailedError,
    );
  });

  it("surfaces HTTP errors from the API", async () => {
    const fetchImpl = vi.fn(async () => json({ message: "unauthorized" }, false, 401));
    const provider = new MeshyProvider({
      apiKey: "bad",
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider.create({ prompt: "x" })).rejects.toThrow(/Meshy API 401/);
  });
});
