import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e))); page.on("console",m=>m.type()==="error"&&errs.push(m.text()));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.locator('.prompt-wrap input').fill("a rubber duck");
await page.locator('.btn.primary').click();
// wait for the model to land in preview
await page.getByText("model ready").waitFor({ timeout: 40000 });
await sleep(7000); // let skinmint-model load+render the optimized glb
await page.screenshot({ path: "/tmp/skinmint-shots/studio-2-preview.png" });
console.log("preview shot done");
// open export
await page.getByText("export", { exact: false }).first().click();
await sleep(800);
await page.screenshot({ path: "/tmp/skinmint-shots/studio-3-export.png" });
console.log("export shot done; errors:", errs.filter(e=>!e.includes("_next")).slice(0,5));
await browser.close();
