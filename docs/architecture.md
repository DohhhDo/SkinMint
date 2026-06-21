# Architecture

SkinMint is a monorepo of small packages. None of them know much about each other —
they connect through narrow interfaces (`SkinProvider`, `Provider`,
`BlobStorage`), so you can swap or skip any piece.

## Two tracks, one viewer

There are two ways to get a GLB, and one way to show it.

**1. Minecraft track (the focus).** A 64×64 skin → a procedural blocky model.

```
character / 立绘 / prompt
   → @skinmint/skin       produce a 64×64 PNG skin
   → @skinmint/mcmodel    box rig + animation clips → GLB
   → @skinmint/embed      <skinmint-model> renders + plays the clips
```

**2. Text→mesh track (legacy, still works).** A prompt → a generated mesh.

```
prompt
   → @skinmint/react      useTextTo3D()                 (browser)
   → @skinmint/server     createGenerationHandler()      (your server, holds the key)
   → @skinmint/core       MeshyProvider → poll → GLB, then optimizeGlb() (Draco/WebP)
   → @skinmint/store      persist GLB + history
   → @skinmint/viewer     <GeneratedModelViewer />        (browser)
```

The Studio app wires both up behind API routes and lets you export from either.

## Why split into packages

- **The viewer is the reusable asset.** `@skinmint/embed` / `@skinmint/viewer` are pure
  front-end, zero backend — they drop into any app.
- **Generation needs a server.** API keys can't reach the browser, so anything
  that holds a key (`@skinmint/server`, the Studio's API routes) stays server-side.
- **The MC builder is pure compute.** `@skinmint/mcmodel` takes bytes in, GLB bytes
  out — no network, no keys, runs anywhere (it powers the instant curated path).

Fusing these into one library would force every consumer to take the whole
thing. Keeping them separate means you can use just the web component, or just
the model builder, or the whole pipeline.

## The Studio app

`examples/next-demo` is the reference app — a guided creator with a "Warm Craft
Studio" look. Its API routes are the glue:

| Route | Does |
| --- | --- |
| `POST /api/mc-char` | curated character → `@skinmint/mcmodel` (no AI, instant) |
| `POST /api/mc` | text prompt → AI skin → `@skinmint/mcmodel` |
| `POST /api/mc-upload` | uploaded 立绘 → img2img **or** caption→skin → `@skinmint/mcmodel` |
| `GET /api/generate?file=` | serves stored GLBs (also the legacy optimize/CORS proxy) |

Generated GLBs live under `.skinmint-data/` (gitignored) via `@skinmint/store`'s
filesystem adapter.

## Decisions worth knowing

A few non-obvious choices that bit us, so you don't get bitten:

- **Skin UVs are not V-flipped.** glTF's UV origin is top-left and `GLTFLoader`
  sets `flipY=false`, so a skin pixel at `(x, y)` maps to UV `(x/64, y/64)` —
  *not* `1 - y/64`. Flipping it sends faces to empty skin regions → an all-black
  model. (A standalone three.js test won't catch this; three textures default
  to `flipY=true`.) Because UVs are normalized by 64, HD skins (128×128) just work.

- **Unlit + nearest filter.** Skins are flat pixel art, so models use
  `KHR_materials_unlit` with `NEAREST` sampling — crisp pixels, no lighting
  smear, and they look right on any background.

- **Limbs are rig nodes, not baked geometry.** Each arm/leg is a separate glTF
  node positioned at its joint; animation clips rotate the nodes. This is what
  makes walk/run/wave possible without per-frame geometry.

- **Provider CDNs often have no CORS.** Raw Meshy URLs can't be fetched in the
  browser. `@skinmint/server` pulls the model server-side, optimizes it (a real
  preview went 6.3 MB → 0.5 MB), and serves it same-origin.

- **HF's serverless inference moved.** `api-inference.huggingface.co` is retired;
  captioning goes through `router.huggingface.co` (OpenAI-compatible) with a
  vision model. See [skin providers](skin-providers.md).

## Stack

pnpm workspaces + Turborepo · TypeScript (strict) · `tsup` builds (ESM + CJS +
`.d.ts`) · three.js / R3F / drei as peer deps · glTF Transform · Next.js 14 ·
Vitest · Playwright (we verify by screenshotting real renders).
