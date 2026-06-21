# @skinmint/server

A framework-agnostic, **bring-your-own-key** text-to-3D generation handler.
It holds your provider API key server-side and exposes a Web-standard
`Request → Response` handler that works in Next.js App Router, Bun, Hono,
Cloudflare Workers, Deno, etc.

```bash
pnpm add @skinmint/server @skinmint/core
```

## Next.js App Router

```ts
// app/api/generate/route.ts
import { createGenerationHandler } from "@skinmint/server";
import { MeshyProvider, MockProvider } from "@skinmint/core";

const provider = process.env.MESHY_API_KEY
  ? new MeshyProvider({ apiKey: process.env.MESHY_API_KEY })
  : new MockProvider(); // keyless fallback for local dev

const handler = createGenerationHandler({ provider, maxPromptLength: 600 });

export const dynamic = "force-dynamic";
export const POST = handler;
export const GET = handler;
```

## Protocol

| Request                         | Response                                             |
| ------------------------------- | ---------------------------------------------------- |
| `POST { prompt, ... }`          | `{ taskId }`                                          |
| `GET ?taskId=x`                 | `{ status, progress, modelUrl?, thumbnailUrl?, error? }` |
| `GET ?taskId=x&download=glb`    | the GLB bytes (Draco/WebP-optimized when enabled)    |

Pair it with [`@skinmint/react`](../react)'s `useTextTo3D` on the client.

## Options

- `provider` — any `@skinmint/core` `Provider` (Meshy, Mock, …).
- `optimize` — `true` or `OptimizeOptions` to stream optimized GLBs on read,
  keyed by task id and cached in memory (no persistent storage needed). When
  enabled, `modelUrl` points at the `&download=glb` endpoint.

> **CORS — important for Meshy.** Meshy's asset CDN serves models **without**
> `Access-Control-Allow-Origin`, so a browser cannot fetch the raw `modelUrl`
> cross-origin (it works in Node, which doesn't enforce CORS). Serve models
> **same-origin** through this handler — enabling `optimize` does exactly that
> (server-side fetch → stream), fixing CORS *and* shrinking the file (a real
> Meshy preview mesh went 6.3 MB → 0.5 MB, ~92%). Without `optimize`, add your
> own same-origin proxy/storage before handing a URL to the viewer.
- `maxPromptLength` — reject oversized prompts.
- `cors` — value for `Access-Control-Allow-Origin`.

> **Bundling note (Next.js):** the optimizer pulls in native/wasm deps. Mark
> them external for the server build so webpack doesn't try to bundle them:
>
> ```js
> // next.config.mjs
> webpack: (config, { isServer }) => {
>   if (isServer) config.externals.push({ sharp: "commonjs sharp", draco3dgltf: "commonjs draco3dgltf" });
>   return config;
> },
> ```
