import { buildMinecraftGLB } from "/Users/mac/Projects/SkinMint/packages/mcmodel/dist/index.js";
import { writeFile } from "node:fs/promises";

const SPACE = "https://nick088-minecraft-skin-generator.hf.space";
const prompt = process.env.PROMPT || "a knight in shining blue armor";
// param order from /gradio_api/info:
// [prompt, sd_model, steps, guidance, precision, seed, filename, model_3d, verbose]
const data = [prompt, "xl", 20, 7.5, "fp16", Math.floor(Math.random() * 2e9), "skin.png", false, false];

console.log("OUT prompt:", prompt);
const post = await fetch(`${SPACE}/gradio_api/call/predict`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data }),
});
const { event_id } = await post.json();
console.log("OUT event_id:", event_id);
if (!event_id) { console.log("OUT no event_id:", await post.text()); process.exit(1); }

// stream the SSE result
const res = await fetch(`${SPACE}/gradio_api/call/predict/${event_id}`);
const text = await res.text();
// find the last data: line that parses to a non-null array
let result = null;
for (const line of text.split("\n")) {
  if (line.startsWith("data:")) {
    const payload = line.slice(5).trim();
    try { const v = JSON.parse(payload); if (Array.isArray(v) && v[0]) result = v; } catch {}
  }
}
if (!result) { console.log("OUT no result. tail:", text.slice(-400)); process.exit(1); }

const img = result[0];
let imgUrl = img.url || img.path;
if (imgUrl && !imgUrl.startsWith("http")) imgUrl = `${SPACE}/gradio_api/file=${imgUrl}`;
console.log("OUT skin url:", imgUrl);

const skinPng = new Uint8Array(await (await fetch(imgUrl)).arrayBuffer());
await writeFile("/tmp/hf-skin.png", skinPng);
console.log("OUT skin bytes:", skinPng.byteLength);

const glb = await buildMinecraftGLB(skinPng, { overlay: true });
await writeFile("/tmp/hf-skin.glb", glb);
console.log("OUT GLB bytes:", glb.byteLength);
