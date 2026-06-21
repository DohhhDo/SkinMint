import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0a0a0b;height:100%}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>
</head><body>
<script type="module">
import * as THREE from "three";

// ---- 1) procedurally paint a 64x64 test skin (canvas) ----
const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
const R = (x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
const skin="#e8b98c", hair="#5a3a2a", shirt="#3b6fb8", pants="#2b3a67";
// head: top,bottom,right,front,left,back
[[8,0,8,8],[16,0,8,8],[0,8,8,8],[8,8,8,8],[16,8,8,8],[24,8,8,8]].forEach(r=>R(...r,skin));
R(8,0,8,8,hair);                       // top = hair
// face (front rect at 8,8): eyes + mouth
R(10,11,1,2,"#222"); R(13,11,1,2,"#222");
R(11,14,2,1,"#a05a4a");
// body
[[20,16,8,4],[28,16,8,4],[16,20,4,12],[20,20,8,12],[28,20,4,12],[32,20,8,12]].forEach(r=>R(...r,shirt));
// right leg
[[4,16,4,4],[8,16,4,4],[0,20,4,12],[4,20,4,12],[8,20,4,12],[12,20,4,12]].forEach(r=>R(...r,pants));
// right arm
[[44,16,4,4],[48,16,4,4],[40,20,4,12],[44,20,4,12],[48,20,4,12],[52,20,4,12]].forEach(r=>R(...r,skin));
// left leg
[[20,48,4,4],[24,48,4,4],[16,52,4,12],[20,52,4,12],[24,52,4,12],[28,52,4,12]].forEach(r=>R(...r,pants));
// left arm
[[36,48,4,4],[40,48,4,4],[32,52,4,12],[36,52,4,12],[40,52,4,12],[44,52,4,12]].forEach(r=>R(...r,skin));

const tex = new THREE.CanvasTexture(cv);
tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
const mat = new THREE.MeshBasicMaterial({ map: tex });

// ---- 2) build the standard MC box rig ----
const S = 1/16; // px -> units
// each face uv rect [x,y,w,h] on the 64x64 skin
function setUV(geo, face, [x,y,w,h]) {
  const uv = geo.attributes.uv;
  const u0=x/64, v0=1-y/64, u1=(x+w)/64, v1=1-(y+h)/64;
  const i=face*4;
  uv.setXY(i+0,u0,v0); uv.setXY(i+1,u1,v0); uv.setXY(i+2,u0,v1); uv.setXY(i+3,u1,v1);
}
// part: size[w,h,d], center[x,y,z] in px; faces {px,nx,py,ny,pz,nz}
function part(size, center, faces) {
  const [w,h,d]=size;
  const g = new THREE.BoxGeometry(w*S,h*S,d*S);
  // box face order: +X,-X,+Y,-Y,+Z,-Z
  setUV(g,0,faces.px); setUV(g,1,faces.nx); setUV(g,2,faces.py);
  setUV(g,3,faces.ny); setUV(g,4,faces.pz); setUV(g,5,faces.nz);
  const m = new THREE.Mesh(g, mat);
  m.position.set(center[0]*S, center[1]*S, center[2]*S);
  return m;
}
const grp = new THREE.Group();
grp.add(part([8,8,8],[0,28,0],{pz:[8,8,8,8],nz:[24,8,8,8],px:[16,8,8,8],nx:[0,8,8,8],py:[8,0,8,8],ny:[16,0,8,8]}));        // head
grp.add(part([8,12,4],[0,18,0],{pz:[20,20,8,12],nz:[32,20,8,12],px:[28,20,4,12],nx:[16,20,4,12],py:[20,16,8,4],ny:[28,16,8,4]})); // body
grp.add(part([4,12,4],[-6,18,0],{pz:[44,20,4,12],nz:[52,20,4,12],px:[48,20,4,12],nx:[40,20,4,12],py:[44,16,4,4],ny:[48,16,4,4]})); // right arm
grp.add(part([4,12,4],[6,18,0],{pz:[36,52,4,12],nz:[44,52,4,12],px:[40,52,4,12],nx:[32,52,4,12],py:[36,48,4,4],ny:[40,48,4,4]}));  // left arm
grp.add(part([4,12,4],[-2,6,0],{pz:[4,20,4,12],nz:[12,20,4,12],px:[8,20,4,12],nx:[0,20,4,12],py:[4,16,4,4],ny:[8,16,4,4]}));       // right leg
grp.add(part([4,12,4],[2,6,0],{pz:[20,52,4,12],nz:[28,52,4,12],px:[24,52,4,12],nx:[16,52,4,12],py:[20,48,4,4],ny:[24,48,4,4]}));   // left leg

// ---- 3) render ----
const scene = new THREE.Scene();
scene.add(grp);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(2); renderer.setSize(700, 780);
document.body.appendChild(renderer.domElement);
const cam = new THREE.PerspectiveCamera(32, 700/780, 0.1, 100);
cam.position.set(2.4, 1.15, 4.2); cam.lookAt(0, 1, 0);
renderer.render(scene, cam);
window.__done = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 700, height: 780 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e)));
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForFunction("window.__done===true", { timeout: 15000 }).catch(()=>{});
await sleep(800);
await page.screenshot({ path: "/tmp/skinmint-shots/mc-verify.png" });
await browser.close();
console.log("errors:", errs.slice(0,4));
