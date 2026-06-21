import { readFileSync, writeFileSync } from "node:fs";
import { HFSpaceSkinProvider } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local","utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const hf = new HFSpaceSkinProvider({ model:"xl", steps:28, hfToken: env.HF_TOKEN });
// clean, model-native prompt — no "minecraft skin / full body / front and back" cruft
const prompt = "gothic lolita girl, long black twin-tail hair with red ribbons, red eyes, pale skin, red and black frilly dress, black thigh-high stockings, black boots";
console.log("prompt:", prompt);
const skin = await hf.generateSkin(prompt);
writeFileSync("/tmp/skinmint-shots/dbg-clean-skin.png", Buffer.from(skin.png));
const glb = await buildMinecraftGLB(skin.png, { overlay:true });
writeFileSync("/tmp/dbg-clean.glb", Buffer.from(glb));
console.log("done");
