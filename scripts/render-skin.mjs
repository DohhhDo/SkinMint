import { buildMinecraftGLB } from "/Users/mac/Projects/SkinMint/packages/mcmodel/dist/index.js";
import { readFile, writeFile } from "node:fs/promises";
const png = new Uint8Array(await readFile(process.env.SKIN));
const glb = await buildMinecraftGLB(png, { overlay: true });
await writeFile("/tmp/skin-out.glb", glb);
console.log("GLB", glb.byteLength);
