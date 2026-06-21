import { MeshyProvider } from "/Users/mac/Projects/SkinMint/packages/core/dist/index.js";
import { writeFile } from "node:fs/promises";

const meshy = new MeshyProvider({ apiKey: process.env.MESHY_API_KEY });
const previewId = "019eb83e-dd03-7265-bf99-c10ecfddc56a";

console.log("DIAG starting refine on existing preview…");
const { taskId } = await meshy.refine(previewId);
console.log("DIAG refine taskId:", taskId);

const task = await meshy.poll(taskId, {
  intervalMs: 5000,
  timeoutMs: 240000,
  onProgress: (t) => console.log(`DIAG   ${t.status} ${t.progress}%`),
});

console.log("DIAG refine glb:", task.modelUrls?.glb?.slice(0, 80));
const buf = new Uint8Array(await (await fetch(task.modelUrls.glb)).arrayBuffer());
await writeFile("/tmp/refine-raw.glb", buf);
console.log("DIAG wrote /tmp/refine-raw.glb", buf.byteLength, "bytes");
