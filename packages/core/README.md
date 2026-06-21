# @skinmint/core

Provider-agnostic **text-to-3D generation** and **glTF optimization** for SkinMint.
Node-side, no React. This is the layer you mount behind your own server with
your own API key — it never runs in the browser.

```bash
pnpm add @skinmint/core
```

## Generation

```ts
import { MeshyProvider } from "@skinmint/core";

const meshy = new MeshyProvider({ apiKey: process.env.MESHY_API_KEY! });

const task = await meshy.generate(
  { prompt: "a cute low-poly robot", targetPolycount: 10000, refine: true },
  { intervalMs: 4000, onProgress: (t) => console.log(t.progress) },
);

console.log(task.modelUrls?.glb); // → optimize, store, render
```

All providers implement the same `Provider` interface, so swapping Meshy for
another backend is a one-line change:

```ts
interface Provider {
  create(options: GenerateOptions): Promise<{ taskId: string }>;
  get(taskId: string): Promise<GenerationTask>;
  generate(options: GenerateOptions, poll?: PollOptions): Promise<GenerationTask>;
}
```

- **`MeshyProvider`** — Meshy v2 text-to-3D (preview → optional refine pass).
- **`MockProvider`** — no API key, deterministic lifecycle. Use it to wire up
  the server/demo and in tests.

`BaseProvider` implements the `create → poll` loop (interval, timeout, progress
callback, `AbortSignal`), so a new provider only implements `create` + `get`.

## Optimization

```ts
import { optimizeGlb } from "@skinmint/core";

const { data, before, after } = await optimizeGlb(glbBytes, {
  draco: true,           // geometry compression (needs draco3dgltf — bundled)
  quantize: true,        // smaller vertex attributes
  textureFormat: "webp", // re-encode textures (needs optional `sharp`)
  textureQuality: 80,
});
```

Real numbers (DamagedHelmet.glb): **3.6 MB → 1.3 MB (≈64% smaller)** with
Draco + quantize + WebP.

The pure-geometry passes (dedup / prune / weld / join / quantize) have no native
dependencies. Draco and WebP are lazily loaded, so consumers that skip `sharp`
can still run everything else.

## Test

```bash
pnpm --filter @skinmint/core test
```

Tests mock `fetch` for the Meshy poll/refine logic and build an in-memory GLB
for the optimizer — no API key, no network.
