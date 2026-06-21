#!/usr/bin/env node
// tachie2skin — 二次元立绘 → Minecraft 皮肤 (img2img), standalone.
//
//   node src/cli.mjs <input-image> [options]
//
// Pipeline:  立绘 ──(optional caption via Qwen3-VL)──▶ prompt
//                 └──(img2img via Modal SDXL skin model)──▶ 64×64 skin.png
//                 └── writes a self-contained skinview3d preview.html
//
// Borrows keys from the main SkinMint .env.local; imports no SkinMint package.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { loadEnv, requireKey } from "./env.mjs";
import { captionImage } from "./vision.mjs";
import { generateSkin } from "./modal.mjs";
import { skinPrompt } from "./style.mjs";
import { writePreview } from "./preview.mjs";

function parseArgs(argv) {
  const args = { _: [], caption: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--no-caption") args.caption = false;
    else if (a === "--caption") args.caption = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--img2img") args.img2img = true;
    else if (a === "--prompt") args.prompt = argv[++i];
    else if (a === "--strength") args.strength = Number(argv[++i]);
    else if (a === "--seed") args.seed = Number(argv[++i]);
    else if (a === "--steps") args.steps = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Unknown option: ${a}`);
    else args._.push(a);
  }
  return args;
}

const HELP = `tachie2skin — 二次元立绘 → Minecraft 皮肤 (img2img)

Usage:
  node src/cli.mjs <input-image> [options]

Options:
  --prompt "<text>"   Override the auto prompt (skips captioning)
  --no-caption        Don't call the vision model; use a generic anime prompt
  --strength <0..1>   img2img denoise strength (default 0.7; higher = freer)
  --seed <int>        Deterministic seed (default 0)
  --steps <int>       Inference steps (default 25)
  --out <dir>         Output dir (default ./out)
  --dry-run           Build the request + prompt but don't call the GPU backend
  -h, --help          Show this help

Keys (borrowed from the main SkinMint env, or lab/tachie2skin/.env):
  MODAL_SKIN_ENDPOINT, MODAL_SKIN_TOKEN   (required — img2img backend)
  HF_TOKEN                                (optional — enables captioning)`;

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const env = loadEnv();
  const inputPath = resolve(args._[0]);
  const ext = extname(inputPath).toLowerCase();
  const mime = MIME[ext] ?? "image/png";
  const image = new Uint8Array(readFileSync(inputPath));
  const outDir = resolve(args.out ?? "out");
  const stem = basename(inputPath, ext);

  // 1) Prompt — explicit override, else caption the 立绘, else generic.
  let caption = "";
  if (args.prompt) {
    caption = args.prompt;
    console.log(`📝 prompt (override): ${caption}`);
  } else if (args.caption && env.HF_TOKEN) {
    process.stdout.write("👁️  captioning 立绘 (Qwen3-VL)… ");
    try {
      caption = await captionImage(image, env.HF_TOKEN, { mime });
      console.log("ok");
      console.log(`   ${caption}`);
    } catch (err) {
      console.log("failed → falling back to generic prompt");
      console.log(`   (${err.message})`);
    }
  } else if (args.caption && !env.HF_TOKEN) {
    console.log("ℹ️  no HF_TOKEN → skipping caption, using generic prompt");
  }
  const prompt = args.prompt ? args.prompt : skinPrompt(caption);

  // 2) img2img backend.
  const endpoint = requireKey(env, "MODAL_SKIN_ENDPOINT", "The img2img skin backend.");
  const token = env.MODAL_SKIN_TOKEN;
  const strength = Number.isFinite(args.strength) ? args.strength : 0.7;
  const seed = Number.isFinite(args.seed) ? args.seed : 0;
  const steps = Number.isFinite(args.steps) ? args.steps : 25;

  console.log(`\n🎨 final prompt: ${prompt}`);
  console.log(`⚙️  strength=${strength} seed=${seed} steps=${steps}`);
  console.log(`🛰️  endpoint: ${endpoint}`);

  if (args.dryRun) {
    console.log("\n(dry run — not calling the GPU backend)");
    return;
  }

  const mode = args.img2img ? "img2img (experimental)" : "text2img";
  process.stdout.write(`\n⏳ generating skin (${mode})… `);
  const png = await generateSkin({
    endpoint, token, prompt, seed, steps,
    ...(args.img2img ? { initImage: image, strength } : {}),
  });
  console.log(`ok (${png.length} bytes)`);

  // 3) Write outputs.
  mkdirSync(outDir, { recursive: true });
  const skinPath = join(outDir, `${stem}.skin.png`);
  writeFileSync(skinPath, png);
  const previewPath = writePreview(outDir, `${stem}.skin.png`, stem);

  console.log(`\n✅ skin:    ${skinPath}`);
  console.log(`👀 preview: ${previewPath}`);
  console.log(`   open it:  open "${previewPath}"`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
