import { MockSkinProvider } from "/Users/mac/Projects/SkinMint/packages/skin/dist/index.js";
import { buildMinecraftGLB } from "/Users/mac/Projects/SkinMint/packages/mcmodel/dist/index.js";
import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

// text → skin → MC GLB
const skin = await new MockSkinProvider().generateSkin("a red wizard with a hat");
const glb = await buildMinecraftGLB(skin.png, { overlay: true });
console.log("skin PNG bytes:", skin.png.byteLength, "| GLB bytes:", glb.byteLength);
const b64 = Buffer.from(glb).toString("base64");

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0a0a0b;height:100%}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script></head><body>
<script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const scene=new THREE.Scene(); const r=new THREE.WebGLRenderer({antialias:true,alpha:true}); r.setPixelRatio(2); r.setSize(700,780); document.body.appendChild(r.domElement);
const cam=new THREE.PerspectiveCamera(32,700/780,0.1,100); cam.position.set(2.4,1.15,4.2); cam.lookAt(0,1,0);
new GLTFLoader().load("data:model/gltf-binary;base64,${b64}", g=>{scene.add(g.scene); r.render(scene,cam); window.__done=true;}, undefined, e=>{window.__done=true;});
</script></body></html>`;
const browser = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport:{width:700,height:780}, deviceScaleFactor:1 });
await page.setContent(HTML,{waitUntil:"networkidle"});
await page.waitForFunction("window.__done===true",{timeout:15000}).catch(()=>{});
await sleep(600); await page.screenshot({ path:"/tmp/skinmint-shots/mc-loop.png" }); await browser.close();
console.log("rendered");
