import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const items = [["0.65","/tmp/dbg-modal-s0.65.glb"],["0.8","/tmp/dbg-modal-s0.8.glb"],["0.92","/tmp/dbg-modal-s0.92.glb"]];
const cells = [];
for (const [label,p] of items) cells.push([label, Buffer.from(await readFile(p)).toString("base64")]);
const HTML=`<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#f3eee1;font-family:monospace}.grid{display:flex}.cell{width:300px;height:360px;position:relative}.cap{position:absolute;top:6px;left:10px;font-size:14px;font-weight:700;color:#1a1815;z-index:2}.vp{width:300px;height:360px}</style>
<script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<div class=grid>${cells.map(([l])=>`<div class=cell><div class=cap>strength ${l}</div><div class=vp id="c${l}"></div></div>`).join("")}</div>
<script type=module>
import * as THREE from "three"; import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
const D=${JSON.stringify(cells)}; let n=0;
for(const [l,b64] of D){const el=document.getElementById("c"+l);const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(2);r.setSize(300,360);el.appendChild(r.domElement);const cam=new THREE.PerspectiveCamera(30,300/360,.1,100);cam.position.set(2.4,1.1,4.6);cam.lookAt(0,1.05,0);new GLTFLoader().load("data:model/gltf-binary;base64,"+b64,g=>{sc.add(g.scene);r.render(sc,cam);if(++n===D.length)window.__done=1},undefined,()=>{if(++n===D.length)window.__done=1})}
</script></body></html>`;
const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:920,height:380},deviceScaleFactor:1});
await p.setContent(HTML,{waitUntil:"networkidle"});await p.waitForFunction("window.__done===1",{timeout:20000}).catch(()=>{});await sleep(700);
await p.screenshot({path:"/tmp/skinmint-shots/dbg-modal-compare.png"});await b.close();console.log("ok");
