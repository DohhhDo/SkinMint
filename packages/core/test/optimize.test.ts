import { describe, it, expect } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { optimizeGlb } from "../src/index";

/** Build a tiny GLB with two identical materials and two triangle meshes. */
async function buildGlbWithDuplicates(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const makePrim = (name: string) => {
    const position = doc
      .createAccessor(`pos-${name}`)
      .setType("VEC3")
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
      .setBuffer(buffer);
    const material = doc
      .createMaterial(`mat-${name}`)
      .setBaseColorFactor([1, 0, 0, 1])
      .setRoughnessFactor(0.5);
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", position)
      .setMaterial(material);
    return doc.createMesh(`mesh-${name}`).addPrimitive(prim);
  };

  const scene = doc.createScene();
  scene.addChild(doc.createNode("a").setMesh(makePrim("a")));
  scene.addChild(doc.createNode("b").setMesh(makePrim("b")));

  return new NodeIO().writeBinary(doc);
}

describe("optimizeGlb", () => {
  it("dedups identical materials and returns a valid GLB", async () => {
    const input = await buildGlbWithDuplicates();

    const before = await new NodeIO().readBinary(input);
    expect(before.getRoot().listMaterials().length).toBe(2);

    // Keep it deterministic/offline: no draco, no quantize, no webp.
    const result = await optimizeGlb(input, {
      draco: false,
      quantize: false,
      textureFormat: "none",
    });

    expect(result.after).toBe(result.data.byteLength);
    expect(result.before).toBe(input.byteLength);

    const after = await new NodeIO().readBinary(result.data);
    expect(after.getRoot().listMaterials().length).toBe(1);
  });

  it("produces a Draco-compressed GLB when requested", async () => {
    const input = await buildGlbWithDuplicates();
    const result = await optimizeGlb(input, { draco: true, quantize: true });

    // Re-reading requires the Draco extension + decoder, so this also proves
    // the output round-trips.
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const draco3d = await import("draco3dgltf");
    io.registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
    const doc = await io.readBinary(result.data);
    expect(doc.getRoot().listMeshes().length).toBeGreaterThan(0);
  });
});
