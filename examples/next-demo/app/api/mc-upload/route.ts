import { join } from "node:path";
import { PNG } from "pngjs";
import { buildMinecraftGLB } from "@skinmint/mcmodel";
import { FileSystemBlobStorage, FileGenerationStore } from "@skinmint/store";
import { extractCharacterSpec } from "@skinmint/skin";
import { projectSkin } from "../../_lib/project";
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

    // ③ BODY from front-projection (real garment pixels); HEAD from the layered compositor —
    //    hair volume + per-column fringe + long hair + accessory stencils (from `head`). The FACE
    //    square is then stamped from a recolored real base (crafted hand-drawn eyes), under the hair.
    const stdBuf = Buffer.from(stdBytes);
    // Sample colors from the ORIGINAL 立绘 — it keeps the true (e.g. saturated lavender) hair the
    // sampler's tint-recovery needs; Qwen's redraw washes light hair toward white. Fall back to the
    // standardized image when the original isn't a decodable PNG (e.g. a JPEG upload).
    let colors: ReturnType<typeof sampleColorsNode> | null = null;
    try { colors = sampleColorsNode(PNG.sync.read(Buffer.from(decoded.bytes))); } catch { /* not a PNG */ }
    if (!colors) { try { colors = sampleColorsNode(PNG.sync.read(stdBuf)); } catch { /* sampler optional */ } }
    // HAIR CALIBRATION. The sampler grabs near-white HIGHLIGHTS for very light hair → a washed,
    // near-NEUTRAL color (light + low chroma). Lightness alone can't catch this (valid light lavender
    // is also light), so test chroma. When the sample is washed, take the VLM's read ONLY if it's a
    // real light HUED color (reject the VLM's dark-brown default — wrong for a light-haired char);
    // otherwise keep the washed sample (at least the right lightness, not a random brown).
    const rgb = (h?: string) => { const m = /#?([0-9a-fA-F]{6})/.exec(h || ""); if (!m) return null; const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const washed = (h?: string) => { const c = rgb(h); if (!c) return true; return Math.max(...c) > 220 && Math.max(...c) - Math.min(...c) < 16; };
    const lightHued = (h?: string) => { const c = rgb(h); return !!c && Math.max(...c) > 150 && Math.max(...c) - Math.min(...c) >= 16; };
    const hairHex = colors?.hair && !washed(colors.hair) ? colors.hair : lightHued(spec?.hair.color) ? spec!.hair.color : colors?.hair || spec?.hair.color;
    const png = projectSkin(stdBuf, { eyeHex, head: spec?.head, hairHex });
    const halo = spec?.head.halo?.has ? { color: spec.head.halo.color } : undefined;
    const glb = await buildMinecraftGLB(png, { overlay: true, chibi: !!body.chibi, base: !!body.base, halo });
    const blobKey = `${id}.glb`;
    await storage.put(blobKey, glb, "model/gltf-binary");
    const modelUrl = `/api/generate?file=${encodeURIComponent(blobKey)}`;
    await store.update(id, { status: "succeeded", modelUrl });

    return Response.json({ id, modelUrl, head: spec?.head ?? null });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "generation failed" }, { status: 500 });
  }
}
