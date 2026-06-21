import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { readFile } from "node:fs/promises";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });

const buf = new Uint8Array(await readFile(process.env.GLB_FILE));
const doc = await io.readBinary(buf);
const root = doc.getRoot();

console.log("materials:", root.listMaterials().length);
for (const m of root.listMaterials()) {
  console.log(
    "  material:", JSON.stringify(m.getName()),
    "baseColorFactor:", m.getBaseColorFactor(),
    "baseColorTexture:", m.getBaseColorTexture() ? "YES" : "no",
  );
}
console.log("textures:", root.listTextures().length);
for (const t of root.listTextures()) {
  console.log("  texture mime:", t.getMimeType(), "bytes:", t.getImage()?.byteLength);
}
console.log("extensionsUsed:", root.listExtensionsUsed().map((e) => e.extensionName));
