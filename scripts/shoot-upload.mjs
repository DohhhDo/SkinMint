import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1240, height: 800 }, deviceScaleFactor: 1 });
const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(800);
// feed a real image into the hidden upload input → triggers client normalize → preview
await p.setInputFiles('input[type=file]', 'examples/next-demo/public/skinmint/icons/klee.png');
await sleep(900);
await p.screenshot({ path: "/tmp/skinmint-shots/upload-preview.png" });
await b.close();
console.log("errors:", errs.slice(0,4));
