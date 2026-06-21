import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { PNG } from "./../examples/next-demo/node_modules/pngjs/lib/png.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const term = process.argv[2] || "raiden shogun";
const MAXN = 12;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const get = (u) => fetch(u, { headers: { "User-Agent": UA, Referer: "https://mcskins.top/" } });
const OUT = `/tmp/curate`; mkdirSync(OUT, { recursive: true });

console.log("searching mcskins.top for:", term);
const html = await (await get(`https://mcskins.top/search?s=${encodeURIComponent(term)}`)).text();
const slugs = [...new Set([...html.matchAll(/\/skin\/([a-z0-9-]+)/g)].map((m) => m[1]))].slice(0, 30);
console.log("found", slugs.length, "candidate slugs");

const cands = [];
for (const slug of slugs) {
  if (cands.length >= MAXN) break;
  try {
    const sh = await (await get(`https://mcskins.top/skin/${slug}`)).text();
    const m = sh.match(/assets\/images\/skin\/([a-z0-9-]+\.png)/);
    if (!m) continue;
    const buf = Buffer.from(await (await get(`https://mcskins.top/${m[0]}`)).arrayBuffer());
    if (buf.length < 800 || buf.slice(1, 4).toString() !== "PNG") continue;
    const png = PNG.sync.read(buf);
    if (png.width !== 64 || png.height !== 64) continue; // modern skins only
    cands.push({ slug, buf });
    writeFileSync(`${OUT}/${cands.length - 1}.png`, buf);
  } catch {}
}
console.log("usable 64×64 skins:", cands.length);
if (!cands.length) { console.log("none found — try a different term"); process.exit(0); }

const cells = [];
for (let i = 0; i < cands.length; i++) cells.push({ i, slug: cands[i].slug, glb: Buffer.from(await buildMinecraftGLB(new Uint8Array(cands[i].buf), { overlay: true })).toString("base64"), skin: cands[i].buf.toString("base64") });

const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace;color:#1a1815}.grid{display:flex;flex-wrap:wrap;padding:8px}.c{width:150px;text-align:center;margin:4px;border:1px solid #ccc;border-radius:8px;padding:4px}.n{font-weight:700;font-size:16px;color:#2c4be0}.sl{font-size:9px;color:#888;word-break:break-all}.vp{width:140px;height:170px;margin:auto}img{height:48px;image-rendering:pixelated}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<div style="padding:8px;font-weight:700">搜索词: ${term} —— 挑一个,告诉我编号</div><div class=grid>
${cells.map(c=>`<div class=c><div class=n>#${c.i}</div><div class=vp data-glb="${c.glb}"></div><img src="data:image/png;base64,${c.skin}"><div class=sl>${c.slug}</div></div>`).join("")}
</div><script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";for(const el of document.querySelectorAll(".vp")){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(d=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.replaceWith(im);r.dispose();r.forceContextLoss();d();},undefined,()=>d())});}window.__done=1;</script></body></html>`;
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 660, height: 900 }, deviceScaleFactor: 1.5 });
await p.setContent(HTML, { waitUntil: "networkidle" });
await p.waitForFunction("window.__done===1", { timeout: 40000 }).catch(() => {});
await sleep(800);
await p.screenshot({ path: "/tmp/skinmint-shots/curate.png", fullPage: true });
await b.close();
cells.forEach((c) => console.log(`#${c.i}  ${c.slug}`));
console.log("→ /tmp/skinmint-shots/curate.png  (saved skins in /tmp/curate/<n>.png)");
