import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e))); page.on("console",m=>m.type()==="error"&&errs.push(m.text()));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(1200);
await page.screenshot({ path: "/tmp/skinmint-shots/min-1-empty.png" });
console.log("empty");
// load a model from history to see inline viewport
await page.locator('.rail-btn').nth(1).click();
await sleep(1500);
await page.getByText("a golden treasure chest").click();
await sleep(8000);
await page.screenshot({ path: "/tmp/skinmint-shots/min-2-model.png" });
console.log("model; errors:", errs.filter(e=>!e.includes("_next")).slice(0,5));
await browser.close();
