import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { buildMinecraftGLB } from "@skinmint/mcmodel";
import { FileSystemBlobStorage, FileGenerationStore } from "@skinmint/store";

// Curated character → its hand-made skin → procedural MC model. No AI: instant.
const dataDir = join(process.cwd(), ".skinmint-data");
const storage = new FileSystemBlobStorage(join(dataDir, "models"));
const store = new FileGenerationStore(join(dataDir, "generations.json"));

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      chibi?: boolean;
      base?: boolean;
    };
    const id = String(body.id ?? "");
    if (!/^[a-z0-9-]+$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

    let png: Uint8Array;
    try {
      png = new Uint8Array(await readFile(join(process.cwd(), "public", "skinmint", "skins", `${id}.png`)));
    } catch {
      return Response.json({ error: "unknown character" }, { status: 404 });
    }

    const chibi = Boolean(body.chibi);
    const base = Boolean(body.base);
    // every model embeds walk/run/wave/idle clips — the action is chosen in the viewer,
    // so it isn't part of the build key.
    const glb = await buildMinecraftGLB(png, { overlay: true, chibi, base });
    const key = `char-${id}${chibi ? "-c" : ""}${base ? "-b" : ""}.glb`;
    await storage.put(key, glb, "model/gltf-binary");
    const modelUrl = `/api/generate?file=${encodeURIComponent(key)}`;
    await store.create({ id: key, prompt: body.name || id, status: "succeeded", modelUrl });

    return Response.json({ id, modelUrl });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
