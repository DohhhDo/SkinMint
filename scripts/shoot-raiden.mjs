import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(900);
await page.locator('.rail-btn').nth(2).click(); // history (3rd btn: new, sliders, history)
await sleep(1500);
// click the raiden voxel record
await page.locator('.hrow', { hasText: 'dark purple braided' }).first().click();
await sleep(9000);
await page.screenshot({ path: "/tmp/skinmint-shots/raiden-voxel.png" });
console.log("errors:", errs.filter(e=>!e.includes('_next')).slice(0,4));
await browser.close();
