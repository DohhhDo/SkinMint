// Headless 3D render of a skin on the Minecraft model via skinview3d, so we can
// see what the USER sees (not just the flat atlas). Screenshots front + back.
//   node scripts/render3d.mjs out/kurumi.jpg_cut.skin.png
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/Users/mac/Projects/SkinMint/node_modules/playwright");

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/render3d.mjs <skin.png>"); process.exit(1); }
const dataUrl = "data:image/png;base64," + readFileSync(path).toString("base64");

const html = `<!doctype html><html><head><meta charset=utf-8></head>
<body style="margin:0;background:#cdbfa9">
<canvas id="c" width="240" height="320"></canvas>
<script type="module">
import { SkinViewer } from "https://esm.sh/skinview3d@3";
const v = new SkinViewer({ canvas: document.getElementById("c"), width: 240, height: 320, skin: ${JSON.stringify(dataUrl)} });
v.zoom = 0.9;
window.__ready = false;
v.loadSkin(${JSON.stringify(dataUrl)}).then(() => { window.__ready = true; });
window.__shoot = (angle) => { v.playerObject.rotation.y = angle; v.render(); return document.getElementById("c").toDataURL("image/png"); };
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setContent(html, { waitUntil: "networkidle" });
try { await page.waitForFunction("window.__ready === true", { timeout: 20000 }); }
catch { console.error("skin did not load; page errors:", errors); await browser.close(); process.exit(1); }

const views = { front: 0, side: Math.PI / 2, back: Math.PI };
const shots = {};
for (const [name, angle] of Object.entries(views)) {
  const d = await page.evaluate((a) => window.__shoot(a), angle);
  shots[name] = Buffer.from(d.split(",")[1], "base64");
}
await browser.close();

// stitch the three views side by side into one PNG via the page? simpler: write separately.
const dir = dirname(path), stem = basename(path, ".png");
for (const [name, buf] of Object.entries(shots)) {
  const out = join(dir, `${stem}.3d_${name}.png`);
  writeFileSync(out, buf);
  console.log("wrote", out);
}
if (errors.length) console.log("page errors:", errors);
