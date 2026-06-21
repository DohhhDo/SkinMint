import { NodeIO } from "@gltf-transform/core";
import { KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { readFileSync } from "node:fs";
const glb = readFileSync(".skinmint-data/models/char-hutao.glb");
const doc = await new NodeIO().registerExtensions([KHRMaterialsUnlit]).readBinary(new Uint8Array(glb));
console.log("animations:", doc.getRoot().listAnimations().map(a => `${a.getName()}(${a.listChannels().length}ch)`));
console.log("nodes:", doc.getRoot().listNodes().map(n => n.getName()));
