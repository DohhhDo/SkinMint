import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { dedup, prune, weld, join, quantize, textureCompress } from "@gltf-transform/functions";

export interface OptimizeOptions {
  /** Apply Draco geometry compression. Default: true (needs `draco3dgltf`). */
  draco?: boolean;
  /** Quantize vertex attributes (smaller, slightly lossy). Default: true. */
  quantize?: boolean;
  /** Re-encode textures. "webp" needs the optional `sharp` dependency. */
  textureFormat?: "webp" | "none";
  /** Texture quality 1–100 when re-encoding. Default: 80. */
  textureQuality?: number;
}

export interface OptimizeResult {
  data: Uint8Array;
  /** Input size in bytes. */
  before: number;
  /** Output size in bytes. */
  after: number;
}

/** Build a NodeIO with Draco decode/encode wired up when available. */
async function createIO(): Promise<{ io: NodeIO; hasDraco: boolean }> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  try {
    const draco3d = await import("draco3dgltf");
    io.registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });
    return { io, hasDraco: true };
  } catch {
    return { io, hasDraco: false };
  }
}

/**
 * Read a GLB, run a cleanup + compression pipeline, and write a GLB.
 *
 * The pure-geometry passes (dedup/prune/weld/join/quantize) have no native
 * dependencies. Draco and WebP are opt-in and lazily loaded, so a consumer
 * that doesn't install them can still run the rest of the pipeline.
 */
export async function optimizeGlb(
  input: Uint8Array,
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const { io, hasDraco } = await createIO();
  const doc = await io.readBinary(input);
  const before = input.byteLength;

  const transforms = [dedup(), prune(), weld(), join()];

  if (options.quantize !== false) {
    transforms.push(quantize());
  }

  if (options.textureFormat === "webp") {
    const sharp = (await import("sharp")).default;
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        quality: options.textureQuality ?? 80,
      }),
    );
  }

  await doc.transform(...transforms);

  const useDraco = options.draco !== false && hasDraco;
  if (useDraco) {
    doc
      .createExtension(KHRDracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      });
  }

  const data = await io.writeBinary(doc);
  return { data, before, after: data.byteLength };
}
