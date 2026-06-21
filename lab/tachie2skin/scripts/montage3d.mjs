// Render several skins on the MC model in a labeled grid → one PNG, for quick
// visual curation. node scripts/montage3d.mjs out.png a.png b.png ...
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/Users/mac/Projects/SkinMint/node_modules/playwright");

const [outPath, ...paths] = process.argv.slice(2);
if (!outPath || !paths.length) { console.error("usage: node scripts/montage3d.mjs <out.png> <skin..>"); process.exit(1); }

const items = paths.map((p) => ({ label: basename(p, ".png"), url: "data:image/png;base64," + readFileSync(p).toString("base64") }));
const cells = items.map((it, i) => `
  <div class="cell"><canvas id="c${i}" width="150" height="200"></canvas><div class="lbl">${it.label}</div></div>`).join("");
const html = `<!doctype html><html><head><meta charset=utf-8><style>
  body{margin:0;background:#cdbfa9;font-family:sans-serif}
  .grid{display:flex;flex-wrap:wrap}
  .cell{width:150px;text-align:center;padding:4px}
  .lbl{font-size:12px;color:#333}
</style></head><body><div class="grid">${cells}</div>
<script type="module">
import { SkinViewer } from "https://esm.sh/skinview3d@3";
const items=${JSON.stringify(items)};
window.__ready=0;
items.forEach((it,i)=>{const v=new SkinViewer({canvas:document.getElementById("c"+i),width:150,height:200,skin:it.url});v.zoom=0.9;v.loadSkin(it.url).then(()=>{v.render();window.__ready++;});});
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
try { await page.waitForFunction(`window.__ready >= ${items.length}`, { timeout: 30000 }); } catch { console.error("some skins didn't load"); }
await page.waitForTimeout(1200);
await page.locator(".grid").screenshot({ path: outPath });
await browser.close();
console.log("wrote", outPath);
