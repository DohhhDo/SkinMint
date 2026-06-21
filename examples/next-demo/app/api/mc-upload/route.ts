import { join } from "node:path";
import { PNG } from "pngjs";
import { buildMinecraftGLB } from "@skinmint/mcmodel";
import { FileSystemBlobStorage, FileGenerationStore } from "@skinmint/store";
import { extractCharacterSpec } from "@skinmint/skin";
import { projectSkin, mergeHeadBody } from "../../_lib/project";
import { generateSkinFromPalette } from "../../_lib/recolor";
import { sampleColorsNode } from "../../_lib/sampleColorsNode";
import { resolveImageProvider, resolveVisionProvider } from "../../_ai/providers";

// Upload / text 立绘 → Minecraft model. "Standardize + HYBRID (recolor head + projected body)":
//   ① Qwen-Image-Edit standardizes the 立绘 → a clean, full-body, front-facing illustration
//      (completes a half-body input; uniform pose/background → reliable to sample & project)
//   ② VLM reads the part spec (iris color, gender, lower garment type)
//   ③ BODY: front-project the standardized image's torso/arms/legs onto the skin (real pixels →
//      black-is-black, no base mismatch). HEAD: retrieve a real base and recolor it (precise
//      hand-drawn face/eyes), recoloring its iris to the read eye color. Merge head+body.
//   ④ rig + animate → model
const STANDARDIZE_PROMPT = "Redraw this exact anime character as a clean, full-body, front-facing standing illustration. Keep the same character, hairstyle, face, outfit and all colors. Show the full body head to feet, including legs and shoes. Plain white background, arms slightly away from the body.";
const dataDir = join(process.cwd(), ".skinmint-data");
const storage = new FileSystemBlobStorage(join(dataDir, "models"));
const store = new FileGenerationStore(join(dataDir, "generations.json"));

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1]!, bytes: new Uint8Array(Buffer.from(m[2]!, "base64")) };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      image?: string;
      name?: string;
      chibi?: boolean;
      base?: boolean;
      colors?: { skin?: string; hair?: string; top?: string; bottom?: string; shoes?: string };
    };

    const decoded = body.image ? decodeDataUrl(body.image) : null;
    if (!decoded) return Response.json({ error: "缺少立绘图片，无法生成" }, { status: 400 });

    const id = `up-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    await store.create({ id, prompt: body.name || "上传立绘", status: "running" });

    // ① standardize → a clean full-body, front-facing redraw (completes a half-body input, uniform
    //    pose/background for reliable projection). Falls back to the original if edit fails / no key.
    let stdBytes: Uint8Array = decoded.bytes;
    try {
      const std = await resolveImageProvider().generate({ image: decoded.bytes, prompt: STANDARDIZE_PROMPT, mime: decoded.mime, size: "768*1024" });
      if (std?.png?.length) stdBytes = std.png;
    } catch { /* keep original */ }

    // ② VLM part spec — iris color + structure. Read the ORIGINAL 立绘 (sharper than the redraw).
    let spec: Awaited<ReturnType<typeof extractCharacterSpec>> | null = null;
    try { spec = await extractCharacterSpec(decoded.bytes, { vision: resolveVisionProvider(), mime: decoded.mime }); } catch { /* graceful */ }
    const eyeHex = spec?.eyes.color;

    // ③ HYBRID: body from projection (real pixels), head from a recolored real base (crafted face).
    const stdBuf = Buffer.from(stdBytes);
    const projected = projectSkin(stdBuf, eyeHex);
    let png = projected;
    try {
      const colors = sampleColorsNode(PNG.sync.read(stdBuf));
      const lower = (spec?.bottom.type === "pants" || spec?.bottom.type === "shorts") ? "pants" as const
        : spec?.bottom.type === "dress" ? "dress" as const : spec?.bottom.type === "skirt" ? "skirt" as const : undefined;
      const recolored = generateSkinFromPalette(
        { ...colors, eyes: eyeHex, accent: spec?.accents?.[0], headwear: spec?.headwear.color },
        { gender: spec?.gender, lower }, { headwear: spec?.headwear.type },
      ).png;
      png = mergeHeadBody(recolored, projected); // head = crafted face, body = projection
    } catch { /* fall back to pure projection */ }
    const glb = await buildMinecraftGLB(png, { overlay: true, chibi: !!body.chibi, base: !!body.base });
    const blobKey = `${id}.glb`;
    await storage.put(blobKey, glb, "model/gltf-binary");
    const modelUrl = `/api/generate?file=${encodeURIComponent(blobKey)}`;
    await store.update(id, { status: "succeeded", modelUrl });

    return Response.json({ id, modelUrl });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }
}
