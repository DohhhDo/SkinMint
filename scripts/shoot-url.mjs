import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const url = process.env.GLB_URL;
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.locator('input[type="text"]').fill(url);
await sleep(9000); // download (6MB) + decode + frames
await page.screenshot({ path: "/tmp/skinmint-shots/meshy-robot-render.png" });
await browser.close();
console.log("done; errors:", errors.length ? errors : "none");
