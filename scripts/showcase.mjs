import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = "/tmp/skinmint-shots";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

// ---- /generate full real flow ----
await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });
await sleep(2500);
await page.screenshot({ path: `${OUT}/show-1-generate-initial.png` });
console.log("1 initial");

await page.getByRole("textbox").first().fill("a friendly cartoon mushroom house");
await page.getByRole("button", { name: "Generate" }).click();

// progress shot
await sleep(9000);
await page.screenshot({ path: `${OUT}/show-2-generate-progress.png` });
console.log("2 progress");

// wait for completion (real Meshy generation)
await page.getByText("done ✓").waitFor({ timeout: 180000 });
await sleep(8000); // load + decode optimized GLB + render frames
await page.screenshot({ path: `${OUT}/show-3-generate-done.png` });
console.log("3 done");

// ---- home playground chrome showcase ----
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.getByRole("combobox").first().selectOption({ label: "Damaged Helmet" });
await page.getByRole("combobox").nth(1).selectOption("sunset");
await page.getByText("Show background", { exact: true }).click();
await sleep(7000);
await page.screenshot({ path: `${OUT}/show-4-playground.png` });
console.log("4 playground");

await browser.close();
console.log("errors:", errors.length ? errors : "none");
