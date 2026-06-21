import { readFileSync, writeFileSync } from "node:fs";
import { QwenImageSkinProvider, HFCaptionProvider, HFSpaceSkinProvider, captionToSkinPrompt } from "../packages/skin/dist/index.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

// load env from the demo's .env.local
const env = Object.fromEntries(
  readFileSync("examples/next-demo/.env.local", "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const OUT = "/tmp/skinmint-shots";
const img = new Uint8Array(readFileSync("/Users/mac/Downloads/狂三.jpg")); // actually webp
const mime = "image/webp";

const STANDARDIZE_PROMPT =
  "Redraw this character as a clean, front-facing, full-body character reference centered on a plain white background. Game/anime art style. Keep the hair, outfit colors and accessories. No text, no scenery, no extra characters.";

console.log("① qwen standardize…");
const qwen = new QwenImageSkinProvider({ apiKey: env.DASHSCOPE_API_KEY, endpoint: env.DASHSCOPE_ENDPOINT });
const std = await qwen.generateSkin(STANDARDIZE_PROMPT, { image: img });
writeFileSync(`${OUT}/dbg-1-standardized.png`, Buffer.from(std.png));
console.log("   saved dbg-1-standardized.png", std.png.length, "bytes");

console.log("② describe (VLM)…");
const cap = new HFCaptionProvider({
  hfToken: env.HF_TOKEN,
  instruction:
    "Describe this character for a Minecraft skin — front-facing full body. List: body type, hair color and style, headwear, top, bottom, footwear, and the 2–3 dominant colors. One compact sentence, visual attributes only, no preamble.",
});
const caption = await cap.caption(std.png, "image/png");
console.log("   CAPTION:", caption);
const prompt = captionToSkinPrompt(`狂三, ${caption}`);
console.log("   SKIN PROMPT:", prompt);

console.log("③ HF text→skin…");
const hf = new HFSpaceSkinProvider({ model: "xl", steps: 22, hfToken: env.HF_TOKEN });
const skin = await hf.generateSkin(prompt);
writeFileSync(`${OUT}/dbg-2-skin64.png`, Buffer.from(skin.png));
console.log("   saved dbg-2-skin64.png", skin.png.length, "bytes");

console.log("④ build GLB…");
const glb = await buildMinecraftGLB(skin.png, { overlay: true });
writeFileSync("/tmp/dbg.glb", Buffer.from(glb));
console.log("   saved /tmp/dbg.glb");
console.log("done.");
