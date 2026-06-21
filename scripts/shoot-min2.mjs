import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(800);
// settings
await page.locator('.settings-fab').click();
await sleep(700);
await page.screenshot({ path: "/tmp/skinmint-shots/min-3-settings.png" });
await page.locator('.sheet .x').click();
await sleep(400);
// load a model then export
await page.locator('.rail-btn').nth(1).click();
await sleep(1200);
await page.getByText("a golden treasure chest").click();
await sleep(2500);
await page.getByText("导出 ↗").click();
await sleep(700);
await page.screenshot({ path: "/tmp/skinmint-shots/min-4-export.png" });
console.log("done; errors:", errs.slice(0,4));
await browser.close();
