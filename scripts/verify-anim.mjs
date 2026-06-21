import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";

const skin = new Uint8Array(await readFile("examples/next-demo/public/skinmint/skins/hutao.png"));
const b64 = Buffer.from(await buildMinecraftGLB(skin, { overlay: true })).toString("base64");

// for each clip, sample 3 phases → a 4×3 grid showing motion
const clips = ["idle", "walk", "run", "wave"];
const phases = [0.0, 0.25, 0.5];
const cells = clips.map((c) => phases.map((p) => `<div class="cell"><div class="cap">${c} @${p}</div><div id="c-${c}-${p}" class="vp"></div></div>`).join("")).join("");

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0a0a0b;color:#7df3b0;font-family:monospace}
.grid{display:grid;grid-template-columns:repeat(3,260px)}.cell{width:260px;height:300px;position:relative}
.cap{position:absolute;top:6px;left:8px;z-index:2;font-size:12px}.vp{width:260px;height:300px}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head>
<body><div class="grid">${cells}</div>
<script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const CLIPS=${JSON.stringify(clips)}, PHASES=${JSON.stringify(phases)};
const url="data:model/gltf-binary;base64,${b64}";
let done=0; const total=CLIPS.length*PHASES.length;
for (const c of CLIPS) for (const p of PHASES) {
  const el=document.getElementById("c-"+c+"-"+p);
  const scene=new THREE.Scene();
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true}); r.setPixelRatio(2); r.setSize(260,300); el.appendChild(r.domElement);
  const cam=new THREE.PerspectiveCamera(32,260/300,0.1,100); cam.position.set(2.6,1.2,4.6); cam.lookAt(0,1.05,0);
  new GLTFLoader().load(url, g=>{
    scene.add(g.scene);
    const mixer=new THREE.AnimationMixer(g.scene);
    const clip=g.animations.find(a=>a.name===c) || g.animations[0];
    const action=mixer.clipAction(clip); action.play();
    mixer.setTime(clip.duration*p);   // jump to phase
    r.render(scene,cam);
    if(++done===total) window.__done=true;
  }, undefined, ()=>{ if(++done===total) window.__done=true; });
}
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 1240 }, deviceScaleFactor: 1 });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForFunction("window.__done===true", { timeout: 25000 }).catch(() => {});
await sleep(900);
await page.screenshot({ path: "/tmp/skinmint-shots/anim.png" });
await browser.close();
console.log("errors:", errs.slice(0, 5));
