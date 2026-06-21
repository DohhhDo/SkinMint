import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/g1-initial.png` });
console.log("shot g1: initial (placeholder)");

await page.getByRole("button", { name: "Generate" }).click();
// wait for the done state, then let the GLB load + render
await page.getByText("done ✓").waitFor({ timeout: 20000 });
await sleep(6000);
await page.screenshot({ path: `${OUT}/g2-generated.png` });
console.log("shot g2: generated (model rendered)");

await browser.close();
console.log("console/page errors:", errors.length ? errors : "none");
