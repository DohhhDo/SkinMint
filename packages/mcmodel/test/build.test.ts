import { describe, it, expect } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { buildMinecraftGLB } from "../src/index";

// A minimal valid 1×1 PNG — the builder only embeds the bytes, never decodes them.
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function read(glb: Uint8Array) {
  return new NodeIO().registerExtensions([KHRMaterialsUnlit]).readBinary(glb);
}

describe("buildMinecraftGLB", () => {
  it("builds a GLB with base + overlay primitives, an unlit material, and the skin texture", async () => {
    const glb = await buildMinecraftGLB(TINY_PNG, { overlay: true });
    expect(glb.byteLength).toBeGreaterThan(0);

    const doc = await read(glb);
    const mesh = doc.getRoot().listMeshes()[0]!;
    expect(mesh.listPrimitives()).toHaveLength(2); // base + overlay
    expect(doc.getRoot().listTextures()).toHaveLength(1);

    const mat = doc.getRoot().listMaterials()[0]!;
    expect(mat.getExtension("KHR_materials_unlit")).toBeTruthy();
    // crisp pixels: nearest sampling
    expect(mat.getBaseColorTextureInfo()!.getMagFilter()).toBe(9728);
  });

  it("omits the overlay layer when disabled", async () => {
    const glb = await buildMinecraftGLB(TINY_PNG, { overlay: false });
    const doc = await read(glb);
    expect(doc.getRoot().listMeshes()[0]!.listPrimitives()).toHaveLength(1);
  });

  it("rigs the body as a static node plus four rotatable limb nodes", async () => {
    const glb = await buildMinecraftGLB(TINY_PNG, { overlay: false });
    const doc = await read(glb);
    const nodes = doc.getRoot().listNodes();
    // character root + body + 4 limbs
    const limbs = nodes.filter((n) => /Arm|Leg/.test(n.getName()));
    expect(limbs).toHaveLength(4);
    // every limb node carries its joint translation (so rotation pivots at the joint)
    for (const l of limbs) expect(l.getTranslation().some((v) => v !== 0)).toBe(true);
  });

  it("embeds walk/run/wave/idle animation clips that drive the limb rotations", async () => {
    const glb = await buildMinecraftGLB(TINY_PNG, { overlay: false });
    const doc = await read(glb);
    const names = doc.getRoot().listAnimations().map((a) => a.getName()).sort();
    expect(names).toEqual(["idle", "run", "walk", "wave"]);
    const walk = doc.getRoot().listAnimations().find((a) => a.getName() === "walk")!;
    expect(walk.listChannels().every((c) => c.getTargetPath() === "rotation")).toBe(true);
    expect(walk.listChannels().length).toBe(4); // four limbs swing
  });

  it("omits animation clips when animated:false", async () => {
    const glb = await buildMinecraftGLB(TINY_PNG, { overlay: false, animated: false });
    const doc = await read(glb);
    expect(doc.getRoot().listAnimations()).toHaveLength(0);
  });
});
