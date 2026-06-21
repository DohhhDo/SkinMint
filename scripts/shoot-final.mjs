import { chromium } from "playwright";
import { setTimeout as sleep } from "node:timers/promises";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page
  .getByRole("textbox")
  .last()
  .fill("http://localhost:3000/api/generate?taskId=019eb66b-7bc7-7402-86c4-f7400ed3af8c&download=glb");
await sleep(12000);
await page.screenshot({ path: "/tmp/skinmint-shots/show-5-real-model.png" });

await browser.close();
console.log("errors:", errors.length ? errors : "none");
