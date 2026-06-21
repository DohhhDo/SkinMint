<h1 align="center">SkinMint</h1>

<p align="center">
  <b>English</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <b>Make a Minecraft-style character, get a model that actually moves.</b><br/>
  Pick a character (or upload your own art) → a true blocky, animated GLB you can drag around and embed anywhere.
</p>

<p align="center">
  <i>🚧 In active development — alpha. The shape is settling but APIs still move, and nothing is on npm yet.</i>
</p>

<p align="center">
  📖 <a href="https://www.vindo.cn/blog/skinmint-anime-to-minecraft">Read the story: how SkinMint turns anime art into Minecraft characters →</a>
</p>

---

SkinMint started as a generic "text → 3D mesh" toolkit. It still has those building
blocks, but the interesting part turned out to be **voxel characters**: AI
text-to-3D makes smooth low-poly blobs, not the crisp blocky look people
actually want from "Minecraft style." So SkinMint leans into the thing that makes
that look work — a fixed box rig + a 64×64 skin — and builds the model
procedurally instead of generating geometry.

The result: you choose a character, and out comes a rigged GLB that **walks,
runs, and waves**, ready to drop into any page as a `<skinmint-model>` element.

```html
<script src="https://your-host/skinmint-embed.global.js"></script>
<skinmint-model src="/hutao.glb" animation="walk" style="width:100%;height:480px"></skinmint-model>
```

## How it works

Everything funnels into one shape — **a 64×64 skin** — then becomes a model:

```
 pick a curated character ─┐
 upload a character 立绘 ───┤
 type a prompt ────────────┘
            │
            ▼   @skinmint/skin      curated PNG, or AI (Modal/HF), or upload→img2img / caption→skin
       a 64×64 skin
            │
            ▼   @skinmint/mcmodel   box rig + walk/run/wave/idle clips, unlit + nearest-filter
     a rigged blocky GLB
            │
            ▼   @skinmint/embed     <skinmint-model> plays the clips, drag to orbit, embed anywhere
```

The box rig is fixed, so the only real problem is the 2D skin — which is cheap
to make well (curated art) or to generate (AI). The model itself is built with
`three.js` geometry + [glTF Transform](https://gltf-transform.dev/), with each
limb as its own node so animation clips can swing them around their joints.

> There's also a **legacy text→mesh track** (`@skinmint/core` + Meshy, rendered by
> `@skinmint/viewer`) from the project's first life. It still works and shares the
> same server/storage plumbing — see [docs/architecture](docs/architecture.md).

## What works today

- **Curated characters → instant animated models.** No AI, no waiting. 25
  Genshin characters from hand-made skins; other IPs are stubbed (即将).
- **A real box rig with animation** — `idle / walk / run / wave`, baked into
  every GLB; the viewer crossfades between them live.
- **Upload your own 立绘.** Two AI routes: image-to-image (best, needs a Modal
  GPU deploy) or a no-GPU fallback (a vision model describes the art → text→skin).
- **Export anywhere** — a self-contained `<skinmint-model>` snippet, an npm import,
  or just the optimized `.glb`.
- **The Studio** — a guided "Warm Craft Studio" creator app (角色 → 造型 → 动作
  → 生成), with the figure shown on a lit pedestal like a collectible.

What's rough / experimental: AI skin quality is "fine, not great"; the public HF
Space is flaky (quota); only Genshin is curated; nothing is published to npm.
See the [roadmap](ROADMAP.md).

## Quick start

```bash
pnpm install
pnpm build
pnpm --filter next-demo dev      # → http://localhost:3000
```

The Studio runs **with zero keys** — curated characters generate instantly.
To enable the AI / upload paths, drop keys into
`examples/next-demo/.env.local` (gitignored):

```bash
HF_TOKEN=hf_xxx                  # free; enables AI skins + the no-GPU upload fallback
MODAL_SKIN_ENDPOINT=https://...  # optional; your own GPU deploy for best upload (img2img)
MODAL_SKIN_TOKEN=...
MESHY_API_KEY=msy_xxx            # optional; only for the legacy text→mesh track
```

See [docs/skin-providers](docs/skin-providers.md) for what each one unlocks.

## Packages

A pnpm + Turborepo monorepo of small, focused packages — use only what you need.

| Package | What it does | Track |
| --- | --- | --- |
| [`@skinmint/mcmodel`](packages/mcmodel) | 64×64 skin → rigged, animated blocky GLB | Minecraft |
| [`@skinmint/skin`](packages/skin) | `SkinProvider` interface + mock / HF / Modal / caption providers | Minecraft |
| [`@skinmint/embed`](packages/embed) | `<skinmint-model>` web component — plays clips, embed anywhere | both |
| [`@skinmint/presets`](packages/presets) | curated style / character / action presets + prompt builder | both |
| [`@skinmint/viewer`](packages/viewer) | R3F `<GeneratedModelViewer />` component | text→mesh |
| [`@skinmint/core`](packages/core) | text→3D `Provider` (Meshy/Mock) + `optimizeGlb()` | text→mesh |
| [`@skinmint/server`](packages/server) | BYO-key generation handler + CORS-fixing optimize proxy | both |
| [`@skinmint/react`](packages/react) | `useTextTo3D()` hook | text→mesh |
| [`@skinmint/store`](packages/store) | pluggable blob storage + history (memory / fs / S3-R2) | both |
| [`examples/next-demo`](examples/next-demo) | **the Studio** — the guided creator app | — |

## Embed anywhere

`<skinmint-model>` is a self-contained custom element (three.js in a Shadow DOM) —
no React, no build step. It plays the clips baked into the GLB:

```html
<skinmint-model src="/model.glb" animation="run" auto-rotate style="height:480px"></skinmint-model>
```

Full attribute list in [docs/embedding](docs/embedding.md).

## Tech

- **Monorepo:** pnpm workspaces + Turborepo; packages built with `tsup` (ESM + CJS + types)
- **3D:** three.js · @react-three/fiber · @react-three/drei (peer deps) · [glTF Transform](https://gltf-transform.dev/)
- **App:** Next.js 14 (App Router)
- **AI skins:** SDXL `minecraft-skin-generator` via Modal or a public HF Space; vision-model captioning via the HF router
- **Verification:** headless Playwright screenshots — we actually *look* at the rendered models, not just diff JSON

## Docs

| | |
| --- | --- |
| [Architecture](docs/architecture.md) | how the pieces fit, the pipelines, key decisions |
| [Minecraft pipeline](docs/minecraft-pipeline.md) | skin → rigged animated GLB, in detail |
| [Skin providers](docs/skin-providers.md) | the AI channels, env vars, deploy |
| [Embedding](docs/embedding.md) | `<skinmint-model>` usage and attributes |
| [Roadmap](ROADMAP.md) | what's done, in progress, planned |
| [Contributing](CONTRIBUTING.md) | setup, build, test, conventions |

## License

[MIT](LICENSE)
