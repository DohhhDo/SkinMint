import { copyFileSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync } from "node:fs";
import { buildMinecraftGLB } from "../packages/mcmodel/dist/index.js";
const [idx, id] = [process.argv[2], process.argv[3]];
const PUB = "examples/next-demo/public/skinmint";
// 1) save skin
copyFileSync(`/tmp/curate/${idx}.png`, `${PUB}/skins/${id}.png`);
// 2) render a clean square icon from the model
const glb = Buffer.from(await buildMinecraftGLB(new Uint8Array(readFileSync(`${PUB}/skins/${id}.png`)), { overlay: true })).toString("base64");
const HTML = `<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#e7dcc4}#v{width:256px;height:256px}</style><script type=importmap>{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body><div id=v></div><script type=module>import * as THREE from "three";import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";const el=document.getElementById("v");const sc=new THREE.Scene();const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(2);r.setSize(256,256);el.appendChild(r.domElement);const cam=new THREE.PerspectiveCamera(26,1,.1,100);cam.position.set(0,1.85,3.0);cam.lookAt(0,1.75,0);new GLTFLoader().load("data:model/gltf-binary;base64,${glb}",g=>{sc.add(g.scene);r.render(sc,cam);window.__d=1;},undefined,()=>window.__d=1);</script></body></html>`;
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
await p.setContent(HTML, { waitUntil: "networkidle" });
await p.waitForFunction("window.__d===1", { timeout: 15000 }).catch(()=>{});
await sleep(500);
await p.screenshot({ path: `${PUB}/icons/${id}.png` });
await b.close();
console.log(`saved skins/${id}.png + icons/${id}.png`);
