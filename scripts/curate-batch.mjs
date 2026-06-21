import { writeFileSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { PNG } from "./../examples/next-demo/node_modules/pngjs/lib/png.js";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

// [id, search term, key (for slug match), display name]
// Batch 3 — female, covered + bangs, varied skirt/dress to disperse the f/skirt collapse
// (rem ×17 in the eval). Distinctive keys to avoid cross-franchise false matches.
const BATCH = [
  // f/dress (one-piece, covered, bangs)
  ["ayaka","kamisato ayaka genshin","ayaka","神里绫华"],
  ["nahida","nahida genshin","nahida","纳西妲"],
  ["tokisaki","tokisaki kurumi date a live","tokisaki","时崎狂三"],
  ["evergarden","violet evergarden","evergarden","薇尔莉特"],
  ["shinobu","shinobu kocho demon slayer","shinobu","胡蝶忍"],
  // f/skirt (separate top + skirt — school uniform / blazer, bangs)
  ["sakurajima","mai sakurajima bunny senpai","sakurajima","樱岛麻衣"],
  ["kitagawa","marin kitagawa dress up darling","kitagawa","喜多川海梦"],
  ["chisato","chisato nishikigi lycoris recoil","chisato","锦木千束"],
  ["mitsuri","mitsuri kanroji demon slayer","mitsuri","甘露寺蜜璃"],
  ["yumeko","yumeko jabami kakegurui","yumeko","蛇喰梦子"],
];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const get = (u) => fetch(u, { headers: { "User-Agent": UA, Referer: "https://mcskins.top/" } });
const PUB = "examples/next-demo/public/skinmint";
mkdirSync("/tmp/curate-batch", { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const picks = [];
for (const [id, term, key, name] of BATCH) {
  const html = await (await get(`https://mcskins.top/search?s=${encodeURIComponent(term)}`)).text();
  const slugs = [...new Set([...html.matchAll(/\/skin\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  const cands = [];
  for (const slug of slugs) {
    if (cands.length >= 14) break;
    try {
      const sh = await (await get(`https://mcskins.top/skin/${slug}`)).text();
      const m = sh.match(/assets\/images\/skin\/([a-z0-9-]+\.png)/); if (!m) continue;
      const buf = Buffer.from(await (await get(`https://mcskins.top/${m[0]}`)).arrayBuffer());
      if (buf.length < 800 || buf.slice(1,4).toString() !== "PNG") continue;
      const png = PNG.sync.read(buf); if (png.width !== 64 || png.height !== 64) continue;
      cands.push({ slug, buf });
    } catch {}
  }
  if (!cands.length) { picks.push({ id, name, slug: "(none)", skin: null }); console.log(id, "NONE"); continue; }
  // auto-pick ONLY a slug that contains the key (no false positives); prefer shortest
  const matched = cands.filter((c) => c.slug.includes(key)).sort((a, b) => a.slug.length - b.slug.length);
  const chosen = matched[0];
  if (!chosen) { picks.push({ id, name, slug: "(no match)", skin: null }); console.log(id, "NO MATCH"); continue; }
  writeFileSync(`${PUB}/skins/${id}.png`, chosen.buf);
  picks.push({ id, name, slug: chosen.slug, skin: chosen.buf.toString("base64"), nCands: cands.length });
  console.log(id, "→", chosen.slug, `(${cands.length} candidates)`);
}

// render icons + verification sheet
const cells = [];
for (const pk of picks) {
  if (!pk.skin) { cells.push(pk); continue; }
  pk.glb = Buffer.from(await buildMinecraftGLB(new Uint8Array(Buffer.from(pk.skin,"base64")), { overlay: true })).toString("base64");
  cells.push(pk);
}
const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace;color:#1a1815}.grid{display:flex;flex-wrap:wrap;padding:8px}.c{width:200px;text-align:center;margin:6px;border:1px solid #ccc;border-radius:10px;padding:6px}.n{font-weight:700;font-size:15px}.sl{font-size:10px;color:#888}.vp{width:180px;height:230px;margin:auto}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<div style="padding:8px;font-weight:700">批量核对 —— 哪个不对告诉我,调完整对照表重挑</div><div class=grid>
${cells.map(c=>`<div class=c><div class=n>${c.name} (${c.id})</div>${c.glb?`<div class=vp data-glb="${c.glb}"></div>`:`<div class=vp style="display:grid;place-items:center;color:#b00">无结果</div>`}<div class=sl>${c.slug}${c.nCands?` · ${c.nCands}选`:""}</div></div>`).join("")}
</div><script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";for(const el of document.querySelectorAll(".vp[data-glb]")){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(30,w/h,.1,100);cam.position.set(2.3,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(d=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.replaceWith(im);r.dispose();r.forceContextLoss();d();},undefined,()=>d())});}window.__done=1;</script></body></html>`;
const p = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1.5 });
await p.setContent(HTML, { waitUntil: "networkidle" });
await p.waitForFunction("window.__done===1", { timeout: 40000 }).catch(()=>{});
await sleep(800);
await p.screenshot({ path: "/tmp/skinmint-shots/batch.png", fullPage: true });
// also render icons for the successful picks
for (const pk of picks) {
  if (!pk.glb) continue;
  const ip = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
  await ip.setContent(`<!DOCTYPE html><html><head><style>html,body{margin:0;background:#e7dcc4}#v{width:256px;height:256px}</style><script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body><div id=v></div><script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";const el=document.getElementById("v");const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(2);r.setSize(256,256);el.appendChild(r.domElement);const cam=new THREE.PerspectiveCamera(26,1,.1,100);cam.position.set(0,1.85,3.0);cam.lookAt(0,1.75,0);new GLTFLoader().load("data:model/gltf-binary;base64,${pk.glb}",g=>{sc.add(g.scene);r.render(sc,cam);window.__d=1;},undefined,()=>window.__d=1);</script></body></html>`, { waitUntil: "networkidle" });
  await ip.waitForFunction("window.__d===1", { timeout: 15000 }).catch(()=>{});
  await sleep(400);
  await ip.screenshot({ path: `${PUB}/icons/${pk.id}.png` });
  await ip.close();
}
await browser.close();
console.log("\nSUMMARY:"); picks.forEach(p=>console.log(" ", p.id, "→", p.slug));
console.log("→ /tmp/skinmint-shots/batch.png");
