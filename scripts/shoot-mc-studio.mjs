import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";
const browser = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, deviceScaleFactor: 1 });
const errs=[]; page.on("pageerror",e=>errs.push(String(e)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await sleep(800);
await page.getByRole("textbox").first().fill("a samurai in red armor");
await page.locator('.send').click();
// running state shot
await sleep(2500);
await page.screenshot({ path: "/tmp/skinmint-shots/mc-studio-running.png" });
console.log("running shot");
// wait for the inline model
await page.locator('.viewport').first().waitFor({ timeout: 150000 });
await sleep(8000);
await page.screenshot({ path: "/tmp/skinmint-shots/mc-studio-done.png" });
console.log("done shot; errors:", errs.filter(e=>!e.includes("_next")).slice(0,4));
await browser.close();
