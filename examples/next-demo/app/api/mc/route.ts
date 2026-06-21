import { join } from "node:path";
import { HFSpaceSkinProvider, ModalSkinProvider, type SkinProvider } from "@skinmint/skin";
import { buildMinecraftGLB } from "@skinmint/mcmodel";
import { FileSystemBlobStorage, FileGenerationStore } from "@skinmint/store";

// Text → Minecraft skin → procedural MC model. The skin provider is swappable:
// prefer your own Modal deployment (stable) when configured, else fall back to
// the free public HF Space (unstable — ZeroGPU quota; an HF token helps).
const skin: SkinProvider = process.env.MODAL_SKIN_ENDPOINT
  ? new ModalSkinProvider({
      endpoint: process.env.MODAL_SKIN_ENDPOINT,
      token: process.env.MODAL_SKIN_TOKEN,
      steps: 25,
    })
  : new HFSpaceSkinProvider({ model: "xl", steps: 22, hfToken: process.env.HF_TOKEN });

// Reuse the same store/dir as /api/generate so its ?file= serving works.
const dataDir = join(process.cwd(), ".skinmint-data");
const storage = new FileSystemBlobStorage(join(dataDir, "models"));
const store = new FileGenerationStore(join(dataDir, "generations.json"));

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { prompt?: string };
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });

    const id = `mc-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    await store.create({ id, prompt, status: "running" });

    const { png } = await skin.generateSkin(prompt);
    const glb = await buildMinecraftGLB(png, { overlay: true });

    const key = `${id}.glb`;
    await storage.put(key, glb, "model/gltf-binary");
    const modelUrl = `/api/generate?file=${encodeURIComponent(key)}`;
    await store.update(id, { status: "succeeded", modelUrl });

    return Response.json({ id, prompt, modelUrl });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 },
    );
  }
}
