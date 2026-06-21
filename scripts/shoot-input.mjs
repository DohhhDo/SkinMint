import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(1200);
await page.screenshot({ path: "/tmp/skinmint-shots/input-1.png" });
// focus + type to show focus glow + active button
await page.locator('.composer input').click();
await page.locator('.composer input').type("一只戴帽子的柴犬");
await sleep(500);
await page.screenshot({ path: "/tmp/skinmint-shots/input-2.png" });
console.log("done");
await browser.close();
