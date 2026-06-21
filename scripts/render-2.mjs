import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const ids = ["klee","hutao","keqing"];
const cells = [];
for (const id of ids) {
  const portrait = readFileSync(`/tmp/skinmint-bench/${id}.png`).toString("base64");
  const glb = Buffer.from(await buildMinecraftGLB(new Uint8Array(readFileSync(`/tmp/skinmint-bench/${id}.skin.png`)), { overlay: true })).toString("base64");
  cells.push({ id, portrait, glb });
}
const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f1ead9;font-family:monospace}.row{display:flex;align-items:center;gap:8px;border-bottom:1px solid #ccc;padding:6px}img{height:280px;border:1px solid #999;border-radius:8px}.lbl{font-weight:700;width:70px}.vp{width:280px;height:340px}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
${cells.map(c=>`<div class=row><span class=lbl>${c.id}</span><img src="data:image/png;base64,${c.portrait}"><div class=vp data-glb="${c.glb}"></div></div>`).join("")}
<script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";for(const el of document.querySelectorAll(".vp")){const w=el.clientWidth,h=el.clientHeight;const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setPixelRatio(2);r.setSize(w,h);const cam=new THREE.PerspectiveCamera(28,w/h,.1,100);cam.position.set(2.2,1.1,4.6);cam.lookAt(0,1.05,0);await new Promise(d=>{new GLTFLoader().load("data:model/gltf-binary;base64,"+el.dataset.glb,g=>{sc.add(g.scene);r.render(sc,cam);const im=new Image();im.width=w;im.height=h;im.src=r.domElement.toDataURL();el.replaceWith(im);r.dispose();r.forceContextLoss();d();},undefined,()=>d())});}window.__done=1;</script></body></html>`;
const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:640,height:1100},deviceScaleFactor:1.5});
await p.setContent(HTML,{waitUntil:"networkidle"});await p.waitForFunction("window.__done===1",{timeout:20000}).catch(()=>{});await sleep(700);
await p.screenshot({path:"/tmp/skinmint-shots/proj-big.png",fullPage:true});await b.close();console.log("ok");
