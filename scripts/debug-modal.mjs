import { readFileSync, writeFileSync } from "node:fs";
import { ModalSkinProvider } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local","utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const std = new Uint8Array(readFileSync("/tmp/skinmint-shots/dbg-1-standardized.png"));
const modal = new ModalSkinProvider({ endpoint: env.MODAL_SKIN_ENDPOINT, token: env.MODAL_SKIN_TOKEN, steps: 30 });
const prompt = "gothic lolita girl, black twin-tail hair, red eyes, red and black frilly dress, black thigh-high stockings, black boots";
for (const strength of [0.65, 0.8, 0.92]) {
  process.stdout.write(`strength ${strength}… `);
  const { png } = await modal.generateSkin(prompt, { image: std, strength });
  writeFileSync(`/tmp/skinmint-shots/dbg-modal-s${strength}.png`, Buffer.from(png));
  const glb = await buildMinecraftGLB(png, { overlay: true });
  writeFileSync(`/tmp/dbg-modal-s${strength}.glb`, Buffer.from(glb));
  console.log("ok");
}
