import { readFileSync, writeFileSync } from "node:fs";
import { ModalSkinProvider } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const env = Object.fromEntries(readFileSync("examples/next-demo/.env.local","utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const seed = new Uint8Array(readFileSync("examples/next-demo/public/skinmint/skins/hutao.png")); // a real skin LAYOUT as the structural seed
const modal = new ModalSkinProvider({ endpoint: env.MODAL_SKIN_ENDPOINT, token: env.MODAL_SKIN_TOKEN, steps: 30 });
const prompt = "gothic lolita girl, black twin-tail hair, red eyes, red and black frilly dress, black thigh-high stockings, black boots";
for (const strength of [0.55, 0.7]) {
  process.stdout.write(`seed-img2img strength ${strength}… `);
  const { png } = await modal.generateSkin(prompt, { image: seed, strength });
  writeFileSync(`/tmp/dbg-seed-s${strength}.glb`, Buffer.from(await buildMinecraftGLB(png, { overlay: true })));
  console.log("ok");
}
