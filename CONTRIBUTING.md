# Contributing to SkinMint

Thanks for your interest! SkinMint is a pnpm + Turborepo monorepo of small,
focused packages. This guide gets you productive quickly.

## Setup

```bash
# Node 18+ and pnpm 9+
corepack enable pnpm        # or: npm i -g pnpm
pnpm install
pnpm build
```

Run the demo:

```bash
pnpm --filter next-demo dev   # http://localhost:3000
```

The demo works **without any API key** — curated Minecraft characters generate
instantly, and the legacy text→mesh path falls back to `MockProvider`. To
exercise the AI / upload paths, add keys to `examples/next-demo/.env.local`
(gitignored — never commit keys). See
[docs/skin-providers](docs/skin-providers.md) for which key unlocks what.

## Repo layout

```
packages/
  mcmodel/  @skinmint/mcmodel  — 64×64 skin → rigged, animated blocky GLB. Pure compute.
  skin/     @skinmint/skin     — SkinProvider interface + mock / HF / Modal / caption.
  embed/    @skinmint/embed    — <skinmint-model> web component. Plays clips. No backend.
  presets/  @skinmint/presets  — curated presets + deterministic prompt builder.
  viewer/   @skinmint/viewer   — React 3D viewer (R3F + drei). No backend.
  core/     @skinmint/core     — Provider interface, Meshy/Mock, optimizeGlb().
  server/   @skinmint/server   — BYO-key Web handler (framework-agnostic).
  react/    @skinmint/react    — useTextTo3D() hook.
  store/    @skinmint/store    — blob storage + history (filesystem / S3 / R2).
examples/
  next-demo/               — the Studio: the guided creator app.
infra/
  modal/                   — optional GPU deploy of the skin model.
```

New here? [docs/architecture](docs/architecture.md) explains how the two tracks
(Minecraft + legacy text→mesh) fit together.

## Workflow

```bash
pnpm build       # build all (Turbo caches; respects dependency order)
pnpm typecheck   # tsc --noEmit across every package
pnpm test        # vitest (core, server, store, mcmodel, skin, presets)
```

Work on a single package:

```bash
pnpm --filter @skinmint/core test
pnpm --filter @skinmint/viewer build
```

Before opening a PR, make sure these are green:

```bash
pnpm build && pnpm typecheck && pnpm test
```

## Conventions

- **TypeScript, strict.** No `any` unless truly unavoidable (and commented).
- **Build tooling:** each package builds with `tsup` to ESM + CJS + `.d.ts`.
- **Peers, not bundles:** UI packages keep `react`/`three`/R3F as peer
  dependencies so consumers share a single instance.
- **`"use client"`:** client packages (`viewer`, `react`) re-add the directive
  to their build output (esbuild strips it) — see their `tsup.config.ts`.
- Match the style of surrounding code; keep changes focused.

## Adding a generation provider

Implement the `Provider` interface from `@skinmint/core` — just `create()` and
`get()`; `BaseProvider` gives you the `create → poll` loop for free. See
[`packages/core/src/providers/meshy.ts`](packages/core/src/providers/meshy.ts)
as a reference, and add tests with a mocked `fetch` (no real API key).

## Adding a skin provider

Implement `SkinProvider` from `@skinmint/skin` — one method, `generateSkin(prompt,
options) → { png, width, height }`. See
[`packages/skin/src/hfspace.ts`](packages/skin/src/hfspace.ts) (text→skin) and
[`packages/skin/src/modal.ts`](packages/skin/src/modal.ts) (text + img2img).
Stub `fetch` in tests; never call a real endpoint.

## Adding a storage backend

Implement `BlobStorage` and/or `GenerationStore` from `@skinmint/store`. See
[`packages/store/src/filesystem.ts`](packages/store/src/filesystem.ts).

## Tests

- Network is mocked (`vi.stubGlobal("fetch", …)`) — tests never hit real APIs.
- Generation logic is tested via `MockProvider`; optimization via an in-memory
  GLB built with `@gltf-transform/core`.

## Verifying 3D visually

Type-checks and unit tests won't catch a flipped UV or a broken pose — those are
**visual** bugs. When you touch `@skinmint/mcmodel` or `@skinmint/embed`, render the
result and look at it. The `scripts/` folder has Playwright harnesses that load
a built GLB, play a clip, and screenshot it headlessly (swiftshader). Treat a
render as part of "done," not an afterthought.

## License

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
