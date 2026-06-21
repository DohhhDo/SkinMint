// Fetch a clean anime matte from the deployed segmentation endpoint and save it.
//   node scripts/seg_fetch.mjs assets/Klee.png  ->  assets/Klee_cut.png
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { loadEnv } from "../src/env.mjs";
import { segmentImage } from "../src/modal.mjs";

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/seg_fetch.mjs <png>"); process.exit(1); }
const env = loadEnv();
if (!env.MODAL_SEG_ENDPOINT) { console.error("MODAL_SEG_ENDPOINT not set — deploy modal/segment.py first"); process.exit(1); }

const image = new Uint8Array(readFileSync(path));
console.log("segmenting (cold start can take a minute)…");
const t = Date.now();
const png = await segmentImage({ endpoint: env.MODAL_SEG_ENDPOINT, token: env.MODAL_SKIN_TOKEN, image });
const out = join(dirname(path), basename(path, ".png") + "_cut.png");
writeFileSync(out, png);
console.log(`ok in ${((Date.now() - t) / 1000).toFixed(0)}s → ${out} (${png.length} bytes)`);
