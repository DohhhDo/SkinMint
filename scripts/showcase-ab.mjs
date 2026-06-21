import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });
await page.getByRole("textbox").first().fill("a small treasure chest");
await page.getByRole("button", { name: "Generate" }).click();

// Finalizing state: provider done, model being optimized/stored → thumbnail shown.
await page.getByText("optimizing model…").waitFor({ timeout: 180000 });
await sleep(500);
await page.screenshot({ path: `${OUT}/ab-1-finalizing.png` });
console.log("1 finalizing (thumbnail placeholder)");

// Done: optimized model served same-origin from storage.
await page.getByText("done ✓").waitFor({ timeout: 60000 });
await sleep(7000);
await page.screenshot({ path: `${OUT}/ab-2-done.png` });
console.log("2 done (stored optimized model)");

// Gallery: persisted history.
await page.goto("http://localhost:3000/gallery", { waitUntil: "networkidle" });
await sleep(7000);
await page.screenshot({ path: `${OUT}/ab-3-gallery.png` });
console.log("3 gallery");

await browser.close();
console.log("errors:", errors.length ? errors : "none");
