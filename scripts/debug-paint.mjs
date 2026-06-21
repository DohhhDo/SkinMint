import { readFileSync, writeFileSync } from "node:fs";
import { extractSkinPalette, paintSkinFromPalette } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local","utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const std = new Uint8Array(readFileSync("/tmp/skinmint-shots/dbg-1-standardized.png")); // the clean standardized 狂三
console.log("extracting palette…");
const pal = await extractSkinPalette(std, { hfToken: env.HF_TOKEN, mime: "image/png" });
console.log("PALETTE:", JSON.stringify(pal));
const png = paintSkinFromPalette(pal);
writeFileSync("/tmp/skinmint-shots/dbg-paint-skin.png", Buffer.from(png));
writeFileSync("/tmp/dbg-paint.glb", Buffer.from(await buildMinecraftGLB(png, { overlay: true })));
console.log("done");
