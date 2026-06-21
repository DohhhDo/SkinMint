import { MeshyProvider } from "/Users/mac/Projects/SkinMint/packages/core/dist/index.js";

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY not set");

const meshy = new MeshyProvider({ apiKey });

console.log("RESULT submitting preview task…");
const { taskId } = await meshy.create({
  prompt: "a cute low-poly robot toy",
});
console.log("RESULT taskId:", taskId);

const task = await meshy.poll(taskId, {
  intervalMs: 5000,
  timeoutMs: 240000,
  onProgress: (t) => console.log(`RESULT   ${t.status} ${t.progress}%`),
});

console.log("RESULT status:", task.status);
console.log("RESULT glb:", task.modelUrls?.glb);
console.log("RESULT thumbnail:", task.thumbnailUrl);
