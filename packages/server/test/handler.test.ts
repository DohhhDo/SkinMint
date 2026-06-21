import { describe, it, expect, vi, afterEach } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import { MockProvider } from "@skinmint/core";
import { MemoryBlobStorage, MemoryGenerationStore } from "@skinmint/store";
import { createGenerationHandler } from "../src/index";

const ORIGIN = "http://localhost/api/generate";

function post(body: unknown): Request {
  return new Request(ORIGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(query: string): Request {
  return new Request(`${ORIGIN}?${query}`);
}

/** A minimal but valid GLB for the optimize/stream path. */
async function tinyGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const position = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute("POSITION", position);
  const mesh = doc.createMesh().addPrimitive(prim);
  doc.createScene().addChild(doc.createNode().setMesh(mesh));
  return new NodeIO().writeBinary(doc);
}

afterEach(() => vi.unstubAllGlobals());

describe("createGenerationHandler", () => {
  it("rejects a POST without a prompt", async () => {
    const handler = createGenerationHandler({ provider: new MockProvider() });
    const res = await handler(post({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prompt is required/);
  });

  it("starts a task and reports status with the raw model URL", async () => {
    const provider = new MockProvider({ glbUrl: "https://cdn/x.glb", stepsToComplete: 2 });
    const handler = createGenerationHandler({ provider });

    const startRes = await handler(post({ prompt: "a duck" }));
    expect(startRes.status).toBe(200);
    const { taskId } = await startRes.json();
    expect(taskId).toBeTruthy();

    // first poll → running
    const s1 = await (await handler(get(`taskId=${taskId}`))).json();
    expect(s1.status).toBe("running");
    expect(s1.modelUrl).toBeUndefined();

    // second poll → succeeded, raw provider URL (optimize disabled)
    const s2 = await (await handler(get(`taskId=${taskId}`))).json();
    expect(s2.status).toBe("succeeded");
    expect(s2.modelUrl).toBe("https://cdn/x.glb");
  });

  it("requires a taskId on GET", async () => {
    const handler = createGenerationHandler({ provider: new MockProvider() });
    const res = await handler(get(""));
    expect(res.status).toBe(400);
  });

  it("streams an optimized GLB when optimize is enabled", async () => {
    const glb = await tinyGlb();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url) === "http://test.local/m.glb") {
          return new Response(glb as unknown as BodyInit, { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const provider = new MockProvider({ glbUrl: "http://test.local/m.glb", stepsToComplete: 1 });
    const handler = createGenerationHandler({ provider, optimize: true });

    const { taskId } = await (await handler(post({ prompt: "x" }))).json();

    const status = await (await handler(get(`taskId=${taskId}`))).json();
    expect(status.status).toBe("succeeded");
    expect(status.modelUrl).toBe(`/api/generate?taskId=${taskId}&download=glb`);

    const dl = await handler(get(`taskId=${taskId}&download=glb`));
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("model/gltf-binary");
    const bytes = new Uint8Array(await dl.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("chains a refine pass and serves the refined (colored) model", async () => {
    const provider = new MockProvider({
      glbUrl: "https://cdn/preview.glb",
      refinedGlbUrl: "https://cdn/refined.glb",
      stepsToComplete: 1,
    });
    const handler = createGenerationHandler({ provider }); // no storage, no optimize

    const { taskId } = await (await handler(post({ prompt: "x", refine: true }))).json();

    let status: { status: string; modelUrl?: string } = { status: "" };
    for (let i = 0; i < 10; i++) {
      status = await (await handler(get(`taskId=${taskId}`))).json();
      if (status.status === "succeeded") break;
    }
    expect(status.status).toBe("succeeded");
    // The served model is the refined one, not the preview.
    expect(status.modelUrl).toBe("https://cdn/refined.glb");
  });

  it("persists to storage, serves the model same-origin, and lists it", async () => {
    const glb = await tinyGlb();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url) === "http://test.local/m.glb") {
          return new Response(glb as unknown as BodyInit, { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const storage = new MemoryBlobStorage();
    const store = new MemoryGenerationStore();
    const provider = new MockProvider({ glbUrl: "http://test.local/m.glb", stepsToComplete: 1 });
    const handler = createGenerationHandler({ provider, optimize: true, storage, store });

    const { taskId } = await (await handler(post({ prompt: "x" }))).json();

    // provider finished, model still being optimized/stored → finalizing
    const fin = await (await handler(get(`taskId=${taskId}`))).json();
    expect(fin.status).toBe("running");
    expect(fin.finalizing).toBe(true);

    // wait for the async persist to complete
    let status: { status: string; modelUrl?: string } = { status: "" };
    for (let i = 0; i < 40; i++) {
      status = await (await handler(get(`taskId=${taskId}`))).json();
      if (status.status === "succeeded" && status.modelUrl) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(status.status).toBe("succeeded");
    expect(status.modelUrl).toBe(`/api/generate?file=${encodeURIComponent(taskId + ".glb")}`);

    // same-origin file serving
    const fileRes = await handler(get(`file=${encodeURIComponent(taskId + ".glb")}`));
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get("content-type")).toBe("model/gltf-binary");
    expect(new Uint8Array(await fileRes.arrayBuffer()).byteLength).toBeGreaterThan(0);

    // gallery listing
    const { generations } = await (await handler(get("list=1"))).json();
    expect(generations).toHaveLength(1);
    expect(generations[0].id).toBe(taskId);
    expect(generations[0].modelUrl).toBeTruthy();
  });
});
