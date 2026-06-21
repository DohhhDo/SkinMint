import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(900);
// open builder (sliders = 2nd rail-btn now after new)
await page.locator('.rail-btn').nth(1).click();
await sleep(800);
// pick a character + action + accessory to populate preview
await page.getByText("胡桃", { exact: true }).click();
await page.getByText("A 字姿势", { exact: true }).click();
await page.getByText("披风", { exact: true }).click();
await sleep(500);
await page.screenshot({ path: "/tmp/skinmint-shots/builder.png" });
console.log("done; errors:", errs.slice(0,4));
await browser.close();
