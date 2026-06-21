import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const skin = new Uint8Array(await readFile("examples/next-demo/public/skinmint/skins/hutao.png"));
const poses = ["stand", "tpose", "wave", "run", "battle"];
const glbs = {};
for (const p of poses) {
  const glb = await buildMinecraftGLB(skin, { overlay: true, pose: p });
  glbs[p] = Buffer.from(glb).toString("base64");
}

const cells = poses
  .map(
    (p) => `<div class="cell"><div class="cap">${p}</div><div id="c-${p}" class="vp"></div></div>`
  )
  .join("");

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0a0a0b;color:#7df3b0;font-family:monospace}
.grid{display:flex;flex-wrap:wrap}.cell{width:280px;height:330px;position:relative}
.cap{position:absolute;top:8px;left:10px;z-index:2;font-size:13px}.vp{width:280px;height:330px}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head>
<body><div class="grid">${cells}</div>
<script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const GLBS=${JSON.stringify(glbs)};
let done=0; const total=Object.keys(GLBS).length;
for (const [p,b64] of Object.entries(GLBS)) {
  const el=document.getElementById("c-"+p);
  const scene=new THREE.Scene();
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true}); r.setPixelRatio(2); r.setSize(280,330); el.appendChild(r.domElement);
  const cam=new THREE.PerspectiveCamera(32,280/330,0.1,100); cam.position.set(2.6,1.2,4.6); cam.lookAt(0,1.1,0);
  new GLTFLoader().load("data:model/gltf-binary;base64,"+b64, g=>{scene.add(g.scene); r.render(scene,cam); if(++done===total)window.__done=true;}, undefined, ()=>{if(++done===total)window.__done=true;});
}
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 840, height: 680 }, deviceScaleFactor: 1 });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForFunction("window.__done===true", { timeout: 20000 }).catch(() => {});
await sleep(800);
await page.screenshot({ path: "/tmp/skinmint-shots/poses.png" });
await browser.close();
console.log("errors:", errs.slice(0, 4));
