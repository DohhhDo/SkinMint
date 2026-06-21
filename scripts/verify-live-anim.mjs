import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const globalJs = await readFile("examples/next-demo/public/skinmint-embed.global.js", "utf8");
const glb = await readFile("examples/next-demo/.skinmint-data/models/char-hutao.glb");
const b64 = Buffer.from(glb).toString("base64");

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0a0a0b;height:100%}skinmint-model{width:560px;height:640px;display:block;margin:0 auto}</style>
</head><body>
<skinmint-model id="m" src="data:model/gltf-binary;base64,${b64}" animation="walk"></skinmint-model>
<script>${globalJs}</script>
<script>
  const el = document.getElementById("m");
  el.addEventListener("load", () => { window.__loaded = true; });
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 560, height: 660 }, deviceScaleFactor: 1 });
const errs = []; page.on("pageerror", e => errs.push(String(e)));
page.on("console", m => { if (m.type()==="error") errs.push("c:"+m.text()); });
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForFunction("window.__loaded===true", { timeout: 15000 }).catch(()=>{});
await sleep(700);
const a = await page.screenshot({ path: "/tmp/skinmint-shots/live-a.png" });
await sleep(1600);
const b = await page.screenshot({ path: "/tmp/skinmint-shots/live-b.png" });
await browser.close();
console.log("loaded:", "errors:", errs.slice(0,5));
console.log("frame bytes a/b:", a.length, b.length, "identical:", Buffer.compare(a,b)===0);
